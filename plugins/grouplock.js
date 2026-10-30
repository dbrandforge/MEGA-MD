import { dailyActivities, lockSchedule } from '../data/dailyActivities.js';
import store from '../lib/lightweight_store.js';
import config from '../config.js';

/**
 * Group Lock / Unlock + Daily Activity Announcer
 * Target group: Mature minded
 *
 * Lock: 01:00 every day
 * Unlock: 06:00 (Mon-Sat) | 12:00 (Sunday)
 * On unlock → send + pin today's activity
 *
 * Redesign (2026-10-29): the previous version required a successful
 * `state.locked === true` before the unlock branch OR the safety-net
 * branch would ever fire. On a night where the lock itself failed (eg.
 * a WhatsApp reconnect blip around 01:00), that meant unlock, the daily
 * activity message, and the pin never happened either - even though
 * none of those three actually depend on the lock having worked.
 *
 * Now the daily activity send+pin is fully decoupled from lock state:
 * it fires once per calendar day, at/after the scheduled unlock time,
 * no matter whether locking succeeded, failed, or was skipped. Locking
 * itself is retried for the whole night window (not just a 10-minute
 * grace period) so a temporary connection blip doesn't cost the entire
 * night, but an admin's deliberate manual `.grouplock unlock` is
 * remembered for the rest of that day's window so the retry logic
 * never fights it.
 */

export const TARGET_GROUP = '120363405434471171@g.us';
const LOCK_STATE_KEY = 'groupLockState';
const LAST_ACTION_KEY = 'groupLockLastAction';
const ACTIVITY_SENT_KEY = 'groupLockActivitySent';
const MANUAL_OVERRIDE_KEY = 'groupLockManualOverride';

function getLagosNow() {
    // Reliable way to get Africa/Lagos time
    const str = new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' });
    return new Date(str);
}

function getCurrentDay() {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[getLagosNow().getDay()];
}

function getCurrentTimeString() {
    const now = getLagosNow();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
}

function getActivityText(day) {
    const activity = dailyActivities[day];
    return activity
        ? activity.full
        : `*Today is ${day.charAt(0).toUpperCase() + day.slice(1)}*\n\nEnjoy the group!`;
}

async function lockGroup(sock, chatId) {
    try {
        await sock.groupSettingUpdate(chatId, 'announcement');
        await sock.sendMessage(chatId, {
            text: '🔒 *Group Locked*\n\nOnly admins can send messages now.\nThe group will reopen at the scheduled time.'
        });
        await store.saveSetting(chatId, LOCK_STATE_KEY, { locked: true, at: Date.now() });
        await store.saveSetting(chatId, LAST_ACTION_KEY, { action: 'lock', time: getCurrentTimeString(), day: getCurrentDay() });
        console.log(`[GroupLock] Locked ${chatId}`);
        return true;
    } catch (e) {
        console.error('Failed to lock group:', e);
        return false;
    }
}

// Unlocks the group setting itself. Safe to call even if it's already
// unlocked - groupSettingUpdate is idempotent from WhatsApp's side.
async function unlockGroupSetting(sock, chatId) {
    try {
        await sock.groupSettingUpdate(chatId, 'not_announcement');
        return true;
    } catch (e) {
        console.error('Failed to unlock group setting:', e);
        return false;
    }
}

// Sends + pins today's activity exactly once per calendar day, no matter
// what the lock state is. This is the piece that used to be stuck behind
// `state.locked === true`.
async function sendDailyActivityOnce(sock, chatId, day) {
    const sentRecord = (await store.getSetting(chatId, ACTIVITY_SENT_KEY)) || {};
    if (sentRecord.day === day) return false; // already sent today

    const activityText = getActivityText(day);

    const sent = await sock.sendMessage(chatId, {
        text: `🔓 *Group Unlocked*\n\n${activityText}`
    });

    try {
        if (sent?.key) {
            await sock.sendMessage(chatId, {
                pin: sent.key,
                type: 1 // pin
            });
        }
    } catch (pinErr) {
        console.log('Could not pin message:', pinErr.message);
    }

    await store.saveSetting(chatId, ACTIVITY_SENT_KEY, { day, sentAt: Date.now() });
    console.log(`[GroupLock] Daily activity sent for ${chatId} - ${day}`);
    return true;
}

// Full unlock: flips the WhatsApp setting, sends/pins the activity (if not
// already sent today), and records state. Used by the manual command and
// by the scheduled/safety-net paths.
async function unlockGroup(sock, chatId, { manual = false } = {}) {
    try {
        await unlockGroupSetting(sock, chatId);

        const day = getCurrentDay();
        await sendDailyActivityOnce(sock, chatId, day);

        await store.saveSetting(chatId, LOCK_STATE_KEY, { locked: false, at: Date.now() });
        await store.saveSetting(chatId, LAST_ACTION_KEY, { action: 'unlock', time: getCurrentTimeString(), day });

        if (manual) {
            // Remember that an admin deliberately unlocked today, so the
            // auto-retry lock logic below doesn't immediately fight them
            // by re-locking the group for the rest of today's window.
            await store.saveSetting(chatId, MANUAL_OVERRIDE_KEY, { day, action: 'unlock' });
        }

        console.log(`[GroupLock] Unlocked ${chatId} - ${day}`);
        return true;
    } catch (e) {
        console.error('Failed to unlock group:', e);
        return false;
    }
}

/**
 * Called every ~15s by the scheduler engine
 */
export async function checkGroupLockSchedule(sock, chatId) {
    // Only run for the target group
    if (chatId !== TARGET_GROUP) return;

    try {
        const day = getCurrentDay();
        const time = getCurrentTimeString();
        const schedule = day === 'sunday' ? lockSchedule.sunday : lockSchedule.default;

        const state = (await store.getSetting(chatId, LOCK_STATE_KEY)) || { locked: false };
        const lastAction = (await store.getSetting(chatId, LAST_ACTION_KEY)) || {};
        const manualOverride = (await store.getSetting(chatId, MANUAL_OVERRIDE_KEY)) || {};

        const [lockH, lockM] = schedule.lock.split(':').map(Number);
        const [unlockH, unlockM] = schedule.unlock.split(':').map(Number);
        const now = getLagosNow();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const lockMinutes = lockH * 60 + lockM;
        const unlockMinutes = unlockH * 60 + unlockM;

        // Night window (e.g. 01:00 - 06:00)
        let shouldBeLocked = false;
        if (lockMinutes < unlockMinutes) {
            shouldBeLocked = nowMinutes >= lockMinutes && nowMinutes < unlockMinutes;
        } else {
            // crosses midnight (e.g. 01:00 lock, 12:00 unlock next day is handled by day)
            shouldBeLocked = nowMinutes >= lockMinutes || nowMinutes < unlockMinutes;
        }

        // The daily activity is completely independent of lock state now:
        // as soon as we reach (or pass) today's unlock time, send+pin it
        // once. This runs even if the lock never succeeded, and even if
        // the bot was offline exactly at unlock time and only catches up
        // later (eg. after a restart).
        if (nowMinutes >= unlockMinutes) {
            await sendDailyActivityOnce(sock, chatId, day);
            // Keep the WhatsApp setting in sync with "should be unlocked"
            // unless an admin deliberately re-locked it after this time.
            if (state.locked && manualOverride.day !== day) {
                await unlockGroupSetting(sock, chatId);
                await store.saveSetting(chatId, LOCK_STATE_KEY, { locked: false, at: Date.now() });
            }
        }

        // Prevent double-firing the lock/unlock *messages* in the same minute
        const alreadyFiredThisMinute = lastAction.time === time && lastAction.day === day;

        // Lock at scheduled time (start of a fresh night - clears any
        // leftover manual-override flag from the previous day automatically
        // since we always compare against today's `day`).
        if (!alreadyFiredThisMinute && time === schedule.lock && !state.locked) {
            await lockGroup(sock, chatId);
            return;
        }

        // Exact scheduled unlock time: do the full unlock (setting +
        // activity, already partly handled above, but this also updates
        // state/lastAction cleanly and handles the "manual" flag reset).
        if (!alreadyFiredThisMinute && time === schedule.unlock && state.locked) {
            await unlockGroup(sock, chatId);
            return;
        }

        // Self-heal: keep retrying the lock for the entire night window if
        // it should be locked but isn't - not just a short grace period.
        // This covers connection blips at 01:00 that used to leave the
        // group unlocked all night (happened for real on 2026-10-29: 4
        // attempts at 01:00 all failed with "Connection Closed"). It never
        // fights a deliberate manual ".grouplock unlock" because that sets
        // manualOverride for today, which we check here.
        if (shouldBeLocked && !state.locked && manualOverride.day !== day) {
            await lockGroup(sock, chatId);
        }

    } catch (e) {
        console.error('checkGroupLockSchedule error:', e);
    }
}

export default {
    command: 'grouplock',
    aliases: ['lock', 'unlock', 'glock'],
    category: 'admin',
    description: 'Manually lock/unlock the group or check schedule',
    usage: '.grouplock [lock|unlock|status]',
    adminOnly: true,
    groupOnly: true,
    async handler(sock, message, args, context) {
        const { chatId } = context;
        const action = (args[0] || '').toLowerCase();

        if (chatId !== TARGET_GROUP) {
            return sock.sendMessage(chatId, {
                text: 'This command is configured for the Mature minded group only.'
            }, { quoted: message });
        }

        if (action === 'lock') {
            const day = getCurrentDay();
            // A deliberate manual lock clears today's "admin unlocked" flag
            // so the group can be auto-managed normally again afterward.
            await store.saveSetting(chatId, MANUAL_OVERRIDE_KEY, { day, action: 'lock' });
            await lockGroup(sock, chatId);
            return;
        }
        if (action === 'unlock') {
            await unlockGroup(sock, chatId, { manual: true });
            return;
        }

        const day = getCurrentDay();
        const time = getCurrentTimeString();
        const schedule = day === 'sunday' ? lockSchedule.sunday : lockSchedule.default;
        const state = (await store.getSetting(chatId, LOCK_STATE_KEY)) || { locked: false };

        await sock.sendMessage(chatId, {
            text: `*Group Lock Status*\n\n` +
                `Current time (Lagos): *${time}*\n` +
                `Day: *${day}*\n` +
                `Currently: ${state.locked ? '🔒 Locked' : '🔓 Unlocked'}\n\n` +
                `Schedule today:\n` +
                `• Lock at *${schedule.lock}*\n` +
                `• Unlock at *${schedule.unlock}*\n\n` +
                `_On unlock the bot sends + pins today's activity._`
        }, { quoted: message });
    }
};
