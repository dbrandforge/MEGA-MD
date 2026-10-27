import { dailyActivities, lockSchedule } from '../data/dailyActivities.js';
import store from '../lib/lightweight_store.js';
import config from '../config.js';

/**
 * Group Lock / Unlock + Daily Activity Announcer
 *
 * Lock times:
 * - Mon-Sat: Lock 1:00 AM, Unlock 6:00 AM
 * - Sunday:  Lock 1:00 AM, Unlock 12:00 PM
 *
 * On unlock → send today's activity and pin it
 */

const LOCK_STATE_KEY = 'groupLockState';

function getCurrentDay() {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    // Use Africa/Lagos timezone
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: config.timeZone || 'Africa/Lagos' }));
    return days[now.getDay()];
}

function getCurrentTimeString() {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: config.timeZone || 'Africa/Lagos' }));
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
}

async function lockGroup(sock, chatId) {
    try {
        await sock.groupSettingUpdate(chatId, 'announcement'); // only admins can send
        await sock.sendMessage(chatId, {
            text: '🔒 *Group Locked*\n\nOnly admins can send messages now.\nThe group will reopen at the scheduled time.'
        });
        await store.saveSetting(chatId, LOCK_STATE_KEY, { locked: true, at: Date.now() });
        console.log(`[GroupLock] Locked ${chatId}`);
    } catch (e) {
        console.error('Failed to lock group:', e);
    }
}

async function unlockGroup(sock, chatId) {
    try {
        await sock.groupSettingUpdate(chatId, 'not_announcement'); // everyone can send

        const day = getCurrentDay();
        const activity = dailyActivities[day];

        let activityText = activity ? activity.full : `*Today is ${day.charAt(0).toUpperCase() + day.slice(1)}*\n\nEnjoy the group!`;

        const sent = await sock.sendMessage(chatId, {
            text: `🔓 *Group Unlocked*\n\n${activityText}`
        });

        // Try to pin the activity message
        try {
            if (sent?.key) {
                await sock.sendMessage(chatId, { pin: sent.key, type: 1 }); // pin
            }
        } catch (pinErr) {
            console.log('Could not pin message (bot may need pin permission):', pinErr.message);
        }

        await store.saveSetting(chatId, LOCK_STATE_KEY, { locked: false, at: Date.now() });
        console.log(`[GroupLock] Unlocked ${chatId} - ${day}`);
    } catch (e) {
        console.error('Failed to unlock group:', e);
    }
}

// This function should be called periodically (e.g. every minute) from the main scheduler
export async function checkGroupLockSchedule(sock, chatId) {
    if (!config.groupLockEnabled) return;

    const day = getCurrentDay();
    const time = getCurrentTimeString();
    const schedule = day === 'sunday' ? lockSchedule.sunday : lockSchedule.default;

    const state = await store.getSetting(chatId, LOCK_STATE_KEY) || { locked: false };

    // Lock time
    if (time === schedule.lock && !state.locked) {
        await lockGroup(sock, chatId);
    }

    // Unlock time
    if (time === schedule.unlock && state.locked) {
        await unlockGroup(sock, chatId);
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

        if (action === 'lock') {
            await lockGroup(sock, chatId);
            return;
        }
        if (action === 'unlock') {
            await unlockGroup(sock, chatId);
            return;
        }

        // Status
        const day = getCurrentDay();
        const time = getCurrentTimeString();
        const schedule = day === 'sunday' ? lockSchedule.sunday : lockSchedule.default;
        const state = await store.getSetting(chatId, LOCK_STATE_KEY) || { locked: false };

        await sock.sendMessage(chatId, {
            text: `*Group Lock Status*\n\nCurrent time: ${time}\nDay: ${day}\nCurrently: ${state.locked ? '🔒 Locked' : '🔓 Unlocked'}\n\nSchedule today:\n• Lock at ${schedule.lock}\n• Unlock at ${schedule.unlock}`
        }, { quoted: message });
    }
};
