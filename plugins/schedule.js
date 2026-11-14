import fs from 'fs';
import path from 'path';
import { dataFile } from '../lib/paths.js';
import store from '../lib/lightweight_store.js';
import { FEATURE_GROUPS, loadFeatureGroups } from '../lib/featureGroups.js';
import { hasMaturedMindedFeatures } from '../lib/groupFeatureAccess.js';
import { checkBirthdayGreetings } from '../lib/birthdayService.js';
import { verifyGroupPresence } from '../lib/groupPresence.js';

const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);
const configPath = dataFile('schedules.json');

async function loadSchedules() {
    try {
        if (HAS_DB) {
            const data = await store.getSetting('global', 'schedules');
            return data || [];
        } else {
            if (!fs.existsSync(configPath)) {
                const dataDir = path.dirname(configPath);
                if (!fs.existsSync(dataDir))
                    fs.mkdirSync(dataDir, { recursive: true });
                fs.writeFileSync(configPath, JSON.stringify([], null, 2));
            }
            return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        }
    } catch {
        return [];
    }
}

async function saveSchedules(data) {
    if (HAS_DB) {
        if (!await store.saveSettingVerified('global', 'schedules', data)) throw new Error('Scheduled-message queue could not be persisted.');
    } else {
        fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
    }
}

function generateId() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
}

function parseTime(input) {
    const now = new Date();
    const relativeMatch = input.match(/^(?:(\d+)h)?(?:(\d+)m)?$/i);
    if (relativeMatch && (relativeMatch[1] || relativeMatch[2])) {
        const hours = parseInt(relativeMatch[1] || '0', 10);
        const minutes = parseInt(relativeMatch[2] || '0', 10);
        if (hours === 0 && minutes === 0) return null;
        return new Date(now.getTime() + (hours * 60 + minutes) * 60 * 1000);
    }
    const clockMatch = input.match(/^(\d{1,2}):(\d{2})(am|pm)?$/i);
    if (clockMatch) {
        let hour = parseInt(clockMatch[1], 10);
        const minute = parseInt(clockMatch[2], 10);
        const meridiem = clockMatch[3]?.toLowerCase();
        if (meridiem === 'pm' && hour < 12) hour += 12;
        if (meridiem === 'am' && hour === 12) hour = 0;
        const target = new Date(now);
        target.setHours(hour, minute, 0, 0);
        if (target.getTime() <= now.getTime()) {
            target.setDate(target.getDate() + 1);
        }
        return target;
    }
    return null;
}

function formatTimeLeft(ms) {
    if (ms <= 0) return 'now';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const parts = [];
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    if (s || parts.length === 0) parts.push(`${s}s`);
    return parts.join(' ');
}

// ── Scheduler Engine ───────────────────────────────────────────────────────
let _engineStarted = false;
let _engineTimer = null;
let _lastBirthdayCheckMinute = null;
let _birthdayCheckInProgress = false;
let _activeSocket = null;
let _trackedGroups = new Set();
const TRACKED_GROUPS_KEY = 'forgeGuardTrackedGroups';

const TIMED_GROUP_MUTE_KEY = 'timedGroupMute';

export async function trackGroup(chatId) {
    if (!chatId?.endsWith('@g.us')) return false;
    _trackedGroups.add(chatId);
    try {
        const saved = await store.getSetting('global', TRACKED_GROUPS_KEY);
        const groups = new Set(Array.isArray(saved) ? saved : []);
        groups.add(chatId);
        const persisted = await store.saveSettingVerified('global', TRACKED_GROUPS_KEY, [...groups]);
        if (!persisted) throw new Error('Tracked group list verification failed.');
        return true;
    } catch (error) {
        console.error('[SCHEDULE] Could not persist tracked group:', error.message);
        return false;
    }
}

async function checkTimedGroupMute(sock, chatId) {
    const mute = await store.getSetting(chatId, TIMED_GROUP_MUTE_KEY);
    if (!mute?.until || Date.now() < mute.until) return;
    // A manual/scheduled feature-group lock takes precedence over a timed
    // group mute. Expiry must not accidentally reopen a group still locked
    // by the daily lifecycle schedule.
    const scheduledLockState = await hasMaturedMindedFeatures(chatId)
        ? await store.getSetting(chatId, 'groupLockState')
        : null;

    // Clear first to prevent repeated unlock attempts/messages on every tick.
    const cleared = { until: null, clearedAt: Date.now() };
    if (!await store.saveSettingVerified(chatId, TIMED_GROUP_MUTE_KEY, cleared)) {
        console.error(`[SCHEDULE] Could not persist timed group mute expiry for ${chatId}`);
        return;
    }
    if (scheduledLockState?.locked) {
        console.log(`[SCHEDULE] Timed group mute expired; preserving active feature-group lock for ${chatId}`);
        return;
    }
    try {
        await sock.groupSettingUpdate(chatId, 'not_announcement');
        await sock.sendMessage(chatId, { text: '🔊 *Timed group mute expired.* Members can send messages again.' });
    } catch (error) {
        // Restore the due record so the next scheduler tick can retry.
        await store.saveSettingVerified(chatId, TIMED_GROUP_MUTE_KEY, mute);
        console.error(`[SCHEDULE] Timed group unlock failed for ${chatId}:`, error.message);
    }
}

export function startSchedulerEngine(sock) {
    // Always refresh the socket reference after reconnects. The timer is
    // created once, but must never retain a stale, closed Baileys socket.
    if (sock) _activeSocket = sock;
    loadFeatureGroups().catch(error => console.error('[SCHEDULE] Feature-group registry load failed:', error.message));
    if (_engineStarted) return;
    _engineStarted = true;

    console.log('[SCHEDULE] Engine started (15-second interval)');

    _engineTimer = setInterval(async () => {
        const activeSocket = _activeSocket;
        if (!activeSocket) {
            console.warn('[SCHEDULE] Tick skipped: no active WhatsApp socket');
            return;
        }
        try {
            await loadFeatureGroups();
            // Birthday delivery shares the existing scheduler; one check per minute
            // avoids creating another timer or adding per-member jobs.
            const birthdayMinute = Math.floor(Date.now() / 60000);
            if (_lastBirthdayCheckMinute !== birthdayMinute && !_birthdayCheckInProgress) {
                _lastBirthdayCheckMinute = birthdayMinute;
                _birthdayCheckInProgress = true;
                try {
                    const result = await checkBirthdayGreetings(activeSocket);
                    if (result?.groupsSent || result?.dmsSent) {
                        console.log(`[BIRTHDAY] Delivered ${result.groupsSent || 0} group greeting(s) and ${result.dmsSent || 0} private greeting(s)`);
                    }
                } catch (error) {
                    console.error('[BIRTHDAY] Scheduler check failed:', error.message);
                } finally {
                    _birthdayCheckInProgress = false;
                }
            }
            // Restore group registrations after a process restart.
            const persistedGroups = await store.getSetting('global', TRACKED_GROUPS_KEY);
            if (Array.isArray(persistedGroups)) persistedGroups.forEach(id => { if (id?.endsWith('@g.us')) _trackedGroups.add(id); });

            // 1. Regular scheduled messages
            const now = Date.now();
            const schedules = await loadSchedules();
            const remaining = [];
            let changed = false;

            for (const item of schedules) {
                if (now >= item.sendAt) {
                    try {
                        if (item.chatId?.endsWith('@g.us')) {
                            const presence = await verifyGroupPresence(activeSocket, item.chatId);
                            if (presence.status !== 'active' || !presence.present) {
                                console.warn(`[SCHEDULE] Skipping due message ID:${item.id}; bot membership in ${item.chatId} is absent or unverified.`);
                                changed = true;
                                continue;
                            }
                        }
                        await activeSocket.sendMessage(item.chatId, { text: item.message });
                        console.log(`[SCHEDULE] ✅ Sent message ID:${item.id}`);
                    } catch (e) {
                        console.error(`[SCHEDULE] ❌ Failed ID:${item.id}: ${e.message}`);
                    }
                    changed = true;
                } else {
                    remaining.push(item);
                }
            }
            if (changed) await saveSchedules(remaining);

            // 2. Day-unlock greetings + group lock + TOD timeouts.
            // Feature groups are always checked, even if nobody has used .schedule.
            const groupsToCheck = new Set([..._trackedGroups, ...FEATURE_GROUPS]);
            for (const chatId of groupsToCheck) {
                // Fail closed: do not run group-specific automations unless WhatsApp
                // confirms that this bot account is currently a participant.
                const presence = await verifyGroupPresence(activeSocket, chatId);
                if (presence.status !== 'active' || !presence.present) continue;
                try {
                    await checkTimedGroupMute(activeSocket, chatId);
                } catch (e) {
                    console.error(`[SCHEDULE] Timed group mute check failed for ${chatId}: ${e.stack || e.message}`);
                }
                try {
                    const { cleanExpiredSoftMutes } = await import('./softmute.js');
                    const removed = await cleanExpiredSoftMutes(chatId);
                    if (removed) console.log(`[SCHEDULE] Cleaned ${removed} expired soft mute(s) in ${chatId}`);
                } catch (e) {
                    console.error(`[SCHEDULE] Soft-mute cleanup failed for ${chatId}: ${e.stack || e.message}`);
                }

                try {
                    const { checkGroupLockSchedule } = await import('./grouplock.js');
                    await checkGroupLockSchedule(activeSocket, chatId);
                } catch (e) {
                    console.error(`[SCHEDULE] Group-lock check failed for ${chatId}: ${e.stack || e.message}`);
                }

                try {
                    const { checkTodTimeouts } = await import('./tod.js');
                    await checkTodTimeouts(activeSocket, chatId);
                } catch (e) {
                    console.error(`[SCHEDULE] TOD timeout check failed for ${chatId}: ${e.stack || e.message}`);
                }
            }
        } catch (e) {
            console.error('[SCHEDULE] Engine error:', e.stack || e.message);
        }
    }, 15000);
}

export { loadSchedules, saveSchedules, generateId, parseTime, formatTimeLeft };

export default {
    command: 'schedule',
    aliases: ['sched', 'remind', 'remindme'],
    category: 'utility',
    description: 'Schedule a message to be sent later in this chat',
    usage: '.schedule <time> <message>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const senderId = context.senderId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};

        startSchedulerEngine(sock);
        trackGroup(chatId);

        if (!args || args.length < 2) {
            return await sock.sendMessage(chatId, {
                text: `*⏰ SCHEDULE A MESSAGE*\n\n` +
                    `*Usage:*\n".schedule <time> <message>"\n\n` +
                    `*Time formats:*\n` +
                    `• 10m → in 10 minutes\n` +
                    `• 2h → in 2 hours\n` +
                    `• 1h30m → in 1 hour 30 minutes\n` +
                    `• 14:30 → today at 2:30 PM\n` +
                    `• 10:30am → today at 10:30 AM`,
                ...channelInfo
            }, { quoted: message });
        }

        const timeInput = args[0];
        const msgText = args.slice(1).join(' ').trim();

        if (!msgText) {
            return await sock.sendMessage(chatId, {
                text: '❌ Please provide a message after the time.',
                ...channelInfo
            }, { quoted: message });
        }

        const targetDate = parseTime(timeInput);
        if (!targetDate) {
            return await sock.sendMessage(chatId, {
                text: `❌ Invalid time format: *${timeInput}*`,
                ...channelInfo
            }, { quoted: message });
        }

        const schedules = await loadSchedules();
        const newItem = {
            id: generateId(),
            chatId,
            senderId,
            message: msgText,
            sendAt: targetDate.getTime(),
            createdAt: Date.now()
        };
        schedules.push(newItem);
        await saveSchedules(schedules);

        const timeLeft = formatTimeLeft(targetDate.getTime() - Date.now());
        const timeStr = targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        await sock.sendMessage(chatId, {
            text: `✅ *Message Scheduled!*\n\n` +
                `📌 *ID:* ${newItem.id}\n` +
                `⏳ *Sends in:* ${timeLeft} (at ${timeStr})\n` +
                `💬 *Message:* ${msgText}`,
            ...channelInfo
        }, { quoted: message });
    }
};
