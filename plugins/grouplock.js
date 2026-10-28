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
 */

const TARGET_GROUP = '120363405434471171@g.us';
const LOCK_STATE_KEY = 'groupLockState';
const LAST_ACTION_KEY = 'groupLockLastAction';

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

async function unlockGroup(sock, chatId) {
    try {
        await sock.groupSettingUpdate(chatId, 'not_announcement');

        const day = getCurrentDay();
        const activity = dailyActivities[day];

        let activityText = activity
            ? activity.full
            : `*Today is ${day.charAt(0).toUpperCase() + day.slice(1)}*\n\nEnjoy the group!`;

        const sent = await sock.sendMessage(chatId, {
            text: `🔓 *Group Unlocked*\n\n${activityText}`
        });

        // Try to pin the activity message for 24 hours
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

        await store.saveSetting(chatId, LOCK_STATE_KEY, { locked: false, at: Date.now() });
        await store.saveSetting(chatId, LAST_ACTION_KEY, { action: 'unlock', time: getCurrentTimeString(), day });
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

        // Prevent double-firing in the same minute
        if (lastAction.time === time && lastAction.day === day) return;

        // Lock at scheduled time
        if (time === schedule.lock && !state.locked) {
            await lockGroup(sock, chatId);
            return;
        }

        // Unlock at scheduled time
        if (time === schedule.unlock && state.locked) {
            await unlockGroup(sock, chatId);
            return;
        }

        // Safety: if it's past unlock time and still locked, unlock
        // (handles bot restart after unlock time)
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

        // Only auto-correct if we're clearly in the wrong state for more than a couple minutes
        if (shouldBeLocked && !state.locked && time !== schedule.unlock) {
            // Don't force lock outside the exact window to avoid surprise locks
        }
        if (!shouldBeLocked && state.locked && time !== schedule.lock) {
            // If past unlock and still locked, unlock
            if (nowMinutes >= unlockMinutes) {
                await unlockGroup(sock, chatId);
            }
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
            await lockGroup(sock, chatId);
            return;
        }
        if (action === 'unlock') {
            await unlockGroup(sock, chatId);
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
