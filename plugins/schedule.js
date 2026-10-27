import fs from 'fs';
import path from 'path';
import { dataFile } from '../lib/paths.js';
import store from '../lib/lightweight_store.js';
import { checkGroupLockSchedule } from './grouplock.js';
import { checkTodTimeouts } from './tod.js';

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
        await store.saveSetting('global', 'schedules', data);
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
let _trackedGroups = new Set();

export function trackGroup(chatId) {
    if (chatId?.endsWith('@g.us')) {
        _trackedGroups.add(chatId);
    }
}

export function startSchedulerEngine(sock) {
    if (_engineStarted) return;
    _engineStarted = true;

    console.log('[SCHEDULE] Engine started (includes Group Lock + TOD timeouts)');

    setInterval(async () => {
        try {
            // 1. Regular scheduled messages
            const now = Date.now();
            const schedules = await loadSchedules();
            const remaining = [];
            let changed = false;

            for (const item of schedules) {
                if (now >= item.sendAt) {
                    try {
                        await sock.sendMessage(item.chatId, { text: item.message });
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

            // 2. Group Lock / Unlock checks + TOD timeouts for tracked groups
            for (const chatId of _trackedGroups) {
                try {
                    await checkGroupLockSchedule(sock, chatId);
                } catch (e) {
                    // silent
                }
                try {
                    await checkTodTimeouts(sock, chatId);
                } catch (e) {
                    // silent
                }
            }
        } catch (e) {
            console.error('[SCHEDULE] Engine error:', e.message);
        }
    }, 15000); // every 15 seconds
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
