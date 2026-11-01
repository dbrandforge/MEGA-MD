import { dailyActivities, lockSchedule } from '../data/dailyActivities.js';
import store from '../lib/lightweight_store.js';
import config from '../config.js';
import { goodnightMessages, goodmorningMessages, pickRotatingMessage } from '../data/groupLifecycleMessages.js';
import { PRIMARY_FEATURE_GROUP, isFeatureGroup } from '../lib/featureGroups.js';

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

export const TARGET_GROUP = PRIMARY_FEATURE_GROUP;
const LOCK_STATE_KEY = 'groupLockState';
const LAST_ACTION_KEY = 'groupLockLastAction';
const ACTIVITY_SENT_KEY = 'groupLockActivitySent';
const MANUAL_OVERRIDE_KEY = 'groupLockManualOverride';
const GOODNIGHT_SENT_KEY = 'groupLockGoodnightSent';
const GOODMORNING_SENT_KEY = 'groupLockGoodmorningSent';
const GOODNIGHT_INDEX_KEY = 'groupLockGoodnightIndex';
const GOODMORNING_INDEX_KEY = 'groupLockGoodmorningIndex';
const DAY_UNLOCK_GREETING_KEY = 'groupDayUnlockGreeting';

function getLagosCalendarParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Lagos',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'long'
    }).formatToParts(date);
    return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
}

export function buildDayUnlockGreeting(date = new Date()) {
    const { day, weekday } = getLagosCalendarParts(date);
    const dateLabel = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Lagos',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }).format(date);

    // New Month takes priority when it falls on a Sunday or Monday.
    if (day === '01') {
        const monthName = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Africa/Lagos',
            month: 'long'
        }).format(date);
        return `🎉 *NEW MONTH. SAME PEOPLE. NEW OPPORTUNITIES TO DISAPPOINT YOURSELVES.*\n\nWelcome to *${monthName}*, everyone! May this month bring progress, good news, money and the discipline to stop postponing the things you swore you'd do last month.\n\nFresh calendar. Fresh chances. Please try not to carry last month's nonsense forward. 😌\n\n📅 ${dateLabel}`;
    }
    if (weekday === 'Sunday') {
        return `☀️ *HAPPY SUNDAY, PEOPLE OF QUESTIONABLE SCHEDULING.*\n\nA new Sunday has arrived. Rest, reset, recharge and prepare for the week ahead. May your peace be uninterrupted, your plans behave themselves and your Monday arrive with reasonable manners.\n\nEnjoy the day. Even this group deserves a little quiet. 😏\n\n📅 ${dateLabel}`;
    }
    if (weekday === 'Monday') {
        return `🚀 *HAPPY NEW WEEK, DISTINGUISHED PROFESSIONALS IN PROCRASTINATION.*\n\nMonday is here again, which means another opportunity to turn those plans into actual results. May the week favour your hustle, reward your effort and reduce the number of excuses we will have to hear.\n\nGet up, get moving and make the week count. Your goals are not going to achieve themselves. 😌\n\n📅 ${dateLabel}`;
    }
    return null;
}

async function sendDayUnlockGreetingOnce(sock, chatId) {
    const { year, month, day } = getLagosCalendarParts();
    const dateKey = `${year}-${month}-${day}`;
    if (await store.getSetting(chatId, DAY_UNLOCK_GREETING_KEY) === dateKey) return false;

    const greeting = buildDayUnlockGreeting();
    if (!greeting) return false;

    await sock.sendMessage(chatId, { text: greeting });
    await store.saveSetting(chatId, DAY_UNLOCK_GREETING_KEY, dateKey);
    console.log(`[GroupLock] Occasion greeting sent to ${chatId} for ${dateKey}`);
    return true;
}


function getLagosNow() {
    // Reliable way to get Africa/Lagos time
    const str = new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' });
    return new Date(str);
}

function getCurrentDateKey() {
    const now = getLagosNow();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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
        const dateKey = getCurrentDateKey();
        const sentRecord = (await store.getSetting(chatId, GOODNIGHT_SENT_KEY)) || {};
        if (sentRecord.date !== dateKey) {
            const previousIndex = (await store.getSetting(chatId, GOODNIGHT_INDEX_KEY)) ?? -1;
            const selected = pickRotatingMessage(goodnightMessages, previousIndex);
            await sock.sendMessage(chatId, {
                text: `🔒 *Group locked for the night.*\n\n${selected.text}`
            });
            await store.saveSetting(chatId, GOODNIGHT_INDEX_KEY, selected.index);
            await store.saveSetting(chatId, GOODNIGHT_SENT_KEY, { date: dateKey, sentAt: Date.now() });
        }
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
    // Occasion greeting is a separate, best-effort message. It must never
    // block, replace, delay, or change the daily activity message or pin.
    try {
        await sendDayUnlockGreetingOnce(sock, chatId);
    } catch (greetingError) {
        console.error(`[GroupLock] Occasion greeting failed for ${chatId}:`, greetingError.message);
    }

    const dateKey = getCurrentDateKey();
    const sentRecord = (await store.getSetting(chatId, ACTIVITY_SENT_KEY)) || {};
    if (sentRecord.date === dateKey) return false; // already sent today

    const activityText = getActivityText(day);
    const morningRecord = (await store.getSetting(chatId, GOODMORNING_SENT_KEY)) || {};
    let greeting = '';
    let selectedGreeting = null;
    if (morningRecord.date !== dateKey) {
        const previousIndex = (await store.getSetting(chatId, GOODMORNING_INDEX_KEY)) ?? -1;
        selectedGreeting = pickRotatingMessage(goodmorningMessages, previousIndex);
        greeting = selectedGreeting.text;
    }

    const sent = await sock.sendMessage(chatId, {
        text: `🔓 *Group unlocked.*\n\n${greeting ? `${greeting}\n\n` : ''}${activityText}`
    });
    if (selectedGreeting) {
        await store.saveSetting(chatId, GOODMORNING_INDEX_KEY, selectedGreeting.index);
        await store.saveSetting(chatId, GOODMORNING_SENT_KEY, { date: dateKey, sentAt: Date.now() });
    }

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

    await store.saveSetting(chatId, ACTIVITY_SENT_KEY, { date: dateKey, day, sentAt: Date.now() });
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
    if (!isFeatureGroup(chatId)) return;

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

        if (!isFeatureGroup(chatId)) {
            return sock.sendMessage(chatId, {
                text: 'This command is enabled only in the authorized feature groups.'
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
