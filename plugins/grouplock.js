import { dailyActivities, lockSchedule } from '../data/dailyActivities.js';
import store from '../lib/lightweight_store.js';
import config from '../config.js';
import { goodnightMessages, goodmorningMessages, pickRotatingMessage } from '../data/groupLifecycleMessages.js';
import { hasMaturedMindedFeatures } from '../lib/groupFeatureAccess.js';
import { PRIMARY_FEATURE_GROUP } from '../lib/featureGroups.js';

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
const GROUP_LOCK_SCHEDULE_KEY = 'groupLockSchedule';
const QUICK_LOCK_KEY = 'groupQuickLock_v1';

// WhatsApp can return 403 when the bot has lost group access or admin rights.
// Avoid hammering the same group every 15 seconds; retry periodically and
// include the group ID so the underlying membership/permission issue is clear.
// Keep one forbidden group from flooding the shared scheduler with retries.
const GROUP_FORBIDDEN_COOLDOWN_MS = 5 * 60 * 1000;
const groupForbiddenUntil = new Map();
const botUnlockEchoUntil = new Map();
const earlyUnlockInFlight = new Set();

// Prevent overlapping scheduler ticks and duplicate daily activity sends per group.
// Different groups remain independent and can progress concurrently.
export function createGroupInFlightGuard() {
    const inFlight = new Set();
    return async function runOnce(key, operation) {
        if (inFlight.has(key)) return false;
        inFlight.add(key);
        try {
            return await operation();
        } finally {
            inFlight.delete(key);
        }
    };
}

const runDailyActivityOnce = createGroupInFlightGuard();
const runScheduledGroupCheck = createGroupInFlightGuard();

function isForbiddenGroupError(error) {
    const status = error?.data?.statusCode ?? error?.data ?? error?.statusCode ?? error?.output?.statusCode;
    return Number(status) === 403 || /forbidden/i.test(String(error?.message || error || ''));
}

function recordGroupLockFailure(chatId, operation, error) {
    if (!isForbiddenGroupError(error)) return false;
    const now = Date.now();
    const previousUntil = groupForbiddenUntil.get(chatId) || 0;
    const retryAt = now + GROUP_FORBIDDEN_COOLDOWN_MS;
    groupForbiddenUntil.set(chatId, retryAt);
    if (previousUntil <= now) {
        console.warn(`[GroupLock] WhatsApp returned 403 during ${operation} for group ${chatId}; pausing scheduled attempts for 5 minutes. Check that the bot is still a member and has the required admin permission.`);
    }
    return true;
}

async function getGroupLockSchedule(chatId) {
    const saved = await store.getSetting(chatId, GROUP_LOCK_SCHEDULE_KEY);
    return {
        default: { ...lockSchedule.default, ...(saved?.default || {}) },
        sunday: { ...lockSchedule.sunday, ...(saved?.sunday || {}) }
    };
}

function validClock(value) {
    return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

async function saveGroupSetting(chatId, key, value) {
    if (!await store.saveSettingVerified(chatId, key, value)) throw new Error(`Group lifecycle state (${key}) could not be persisted.`);
}

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
    await saveGroupSetting(chatId, DAY_UNLOCK_GREETING_KEY, dateKey);
    console.log(`[GroupLock] Occasion greeting sent to ${chatId} for ${dateKey}`);
    return true;
}


export function parseQuickLockDuration(token) {
    const value = String(token || '').trim().toLowerCase();
    if (!/^(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?$/.test(value) || !/\d/.test(value)) return null;
    const match = value.match(/^(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?$/);
    const duration = Number(match[1] || 0) * 86400000 + Number(match[2] || 0) * 3600000 + Number(match[3] || 0) * 60000;
    return Number.isSafeInteger(duration) && duration >= 60000 && duration <= 7 * 86400000 ? duration : null;
}

export function parseQuickLockStartAt(clock, now = new Date()) {
    const value = String(clock || '').trim().toLowerCase();
    if (value === 'now') return now.getTime();
    const match12 = value.match(/^(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)$/);
    const match24 = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!match12 && !match24) return null;
    let hour = Number(match12 ? match12[1] : match24[1]);
    const minute = Number(match12 ? match12[2] || 0 : match24[2]);
    if (match12) { if (match12[3] === 'pm' && hour < 12) hour += 12; if (match12[3] === 'am' && hour === 12) hour = 0; }
    const { year, month, day } = getLagosCalendarParts(now);
    let target = Date.UTC(Number(year), Number(month) - 1, Number(day), hour, minute) - 3600000;
    if (target <= now.getTime()) target += 86400000;
    return target;
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
            await saveGroupSetting(chatId, GOODNIGHT_INDEX_KEY, selected.index);
            await saveGroupSetting(chatId, GOODNIGHT_SENT_KEY, { date: dateKey, sentAt: Date.now() });
        }
        await saveGroupSetting(chatId, LOCK_STATE_KEY, { locked: true, at: Date.now() });
        await saveGroupSetting(chatId, LAST_ACTION_KEY, { action: 'lock', time: getCurrentTimeString(), day: getCurrentDay() });
        console.log(`[GroupLock] Locked ${chatId}`);
        return true;
    } catch (e) {
        if (!recordGroupLockFailure(chatId, 'lock', e)) console.error(`[GroupLock] Failed to lock group ${chatId}:`, e);
        return false;
    }
}

// Unlocks the group setting itself. Safe to call even if it's already
// unlocked - groupSettingUpdate is idempotent from WhatsApp's side.
async function unlockGroupSetting(sock, chatId) {
    try {
        botUnlockEchoUntil.set(chatId, Date.now() + 15_000);
        await sock.groupSettingUpdate(chatId, 'not_announcement');
        return true;
    } catch (e) {
        botUnlockEchoUntil.delete(chatId);
        if (!recordGroupLockFailure(chatId, 'unlock setting', e)) console.error(`[GroupLock] Failed to unlock group setting ${chatId}:`, e);
        return false;
    }
}

// Sends + pins today's activity exactly once per calendar day, no matter
// what the lock state is. This is the piece that used to be stuck behind
// `state.locked === true`.
async function sendDailyActivityOnceUnlocked(sock, chatId, day) {
    // Occasion greeting is a separate, best-effort message. It must never
    // block, replace, delay, or change the daily activity message or pin.
    try {
        await sendDayUnlockGreetingOnce(sock, chatId);
    } catch (greetingError) {
        if (!recordGroupLockFailure(chatId, 'occasion greeting', greetingError)) console.error(`[GroupLock] Occasion greeting failed for ${chatId}:`, greetingError.message);
    }
    if ((groupForbiddenUntil.get(chatId) || 0) > Date.now()) return false;

    const dateKey = getCurrentDateKey();
    const sentRecord = (await store.getSetting(chatId, ACTIVITY_SENT_KEY)) || {};
    if (sentRecord.date === dateKey) {
        if (sentRecord.status === 'sending') {
            console.warn(`[GroupLock] Daily activity reservation already exists for ${chatId} on ${dateKey}; skipping to prevent a duplicate send.`);
        }
        return false; // sent or already reserved today
    }

    // Claim before contacting WhatsApp. If the process or database fails after
    // WhatsApp accepts the message, the next scheduler tick must not duplicate it.
    const activityClaim = { date: dateKey, day, status: 'sending', startedAt: Date.now() };
    if (!await store.saveSettingVerified(chatId, ACTIVITY_SENT_KEY, activityClaim)) {
        throw new Error('Daily activity send reservation could not be persisted.');
    }

    const activityText = getActivityText(day);
    const morningRecord = (await store.getSetting(chatId, GOODMORNING_SENT_KEY)) || {};
    let greeting = '';
    let selectedGreeting = null;
    if (morningRecord.date !== dateKey) {
        const previousIndex = (await store.getSetting(chatId, GOODMORNING_INDEX_KEY)) ?? -1;
        selectedGreeting = pickRotatingMessage(goodmorningMessages, previousIndex);
        greeting = selectedGreeting.text;
    }

    let sent;
    try {
        sent = await sock.sendMessage(chatId, {
            text: `🔓 *Group unlocked.*\n\n${greeting ? `${greeting}\n\n` : ''}${activityText}`
        });
    } catch (sendError) {
        // A rejected send can still have an ambiguous delivery outcome (for
        // example, a transport timeout after WhatsApp accepted the message).
        // Retain today's reservation rather than risk a duplicate announcement.
        console.error(`[GroupLock] Daily activity send outcome is uncertain for ${chatId}; retaining today's reservation to prevent duplicates: ${sendError.message}`);
        throw sendError;
    }
    if (selectedGreeting) {
        await saveGroupSetting(chatId, GOODMORNING_INDEX_KEY, selectedGreeting.index);
        await saveGroupSetting(chatId, GOODMORNING_SENT_KEY, { date: dateKey, sentAt: Date.now() });
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

    await saveGroupSetting(chatId, ACTIVITY_SENT_KEY, {
        date: dateKey,
        day,
        status: 'sent',
        sentAt: Date.now(),
        messageId: sent?.key?.id || null
    });
    console.log(`[GroupLock] Daily activity sent for ${chatId} - ${day}`);
    return true;
}

async function sendDailyActivityOnce(sock, chatId, day) {
    return runDailyActivityOnce(chatId, () => sendDailyActivityOnceUnlocked(sock, chatId, day));
}

// Full unlock: flips the WhatsApp setting, sends/pins the activity (if not
// already sent today), and records state. Used by the manual command and
// by the scheduled/safety-net paths.
export async function setManualGroupUnlockOverride(chatId) {
    const day = getCurrentDay();
    const writes = await Promise.all([
        store.saveSettingVerified(chatId, MANUAL_OVERRIDE_KEY, { day, action: 'unlock' }),
        store.saveSettingVerified(chatId, LOCK_STATE_KEY, { locked: false, at: Date.now() }),
        store.saveSettingVerified(chatId, LAST_ACTION_KEY, {
            action: 'unlock',
            time: getCurrentTimeString(),
            day
        })
    ]);
    if (writes.some(saved => !saved)) throw new Error('Manual group unlock state could not be persisted.');
    return true;
}

async function unlockGroup(sock, chatId, { manual = false } = {}) {
    try {
        if (!await unlockGroupSetting(sock, chatId)) return false;

        const day = getCurrentDay();
        await sendDailyActivityOnce(sock, chatId, day);

        await saveGroupSetting(chatId, LOCK_STATE_KEY, { locked: false, at: Date.now() });
        await saveGroupSetting(chatId, LAST_ACTION_KEY, { action: 'unlock', time: getCurrentTimeString(), day });

        if (manual) {
            // Remember that an admin deliberately unlocked today, so the
            // auto-retry lock logic below doesn't immediately fight them
            // by re-locking the group for the rest of today's window.
            await saveGroupSetting(chatId, MANUAL_OVERRIDE_KEY, { day, action: 'unlock' });
        }

        console.log(`[GroupLock] Unlocked ${chatId} - ${day}`);
        return true;
    } catch (e) {
        if (!recordGroupLockFailure(chatId, 'unlock', e)) console.error(`[GroupLock] Failed to unlock group ${chatId}:`, e);
        return false;
    }
}


export function isEarlyManualUnlockUpdate(update, state, nowMinutes, unlockMinutes) {
    return Boolean(update?.announce === false && state?.locked === true &&
        Number.isFinite(nowMinutes) && Number.isFinite(unlockMinutes) && nowMinutes < unlockMinutes);
}
export async function handleGroupSettingUpdate(sock, updates) {
    const list = Array.isArray(updates) ? updates : [updates];
    for (const update of list) {
        const chatId = update?.id;
        if (!chatId?.endsWith('@g.us') || update.announce !== false) continue;
        const echoUntil = botUnlockEchoUntil.get(chatId) || 0;
        if (echoUntil > Date.now()) { botUnlockEchoUntil.delete(chatId); continue; }
        botUnlockEchoUntil.delete(chatId);
        if (earlyUnlockInFlight.has(chatId)) continue;
        earlyUnlockInFlight.add(chatId);
        try {
            if (!await hasMaturedMindedFeatures(chatId)) continue;
            const state = (await store.getSetting(chatId, LOCK_STATE_KEY)) || { locked: false };
            const day = getCurrentDay();
            const schedules = await getGroupLockSchedule(chatId);
            const schedule = day === 'sunday' ? schedules.sunday : schedules.default;
            const [unlockH, unlockM] = schedule.unlock.split(':').map(Number);
            const now = getLagosNow();
            const nowMinutes = now.getHours() * 60 + now.getMinutes();
            const unlockMinutes = unlockH * 60 + unlockM;
            if (!isEarlyManualUnlockUpdate(update, state, nowMinutes, unlockMinutes)) continue;
            const dateKey = getCurrentDateKey();
            const writes = await Promise.all([
                store.saveSettingVerified(chatId, MANUAL_OVERRIDE_KEY, { day, action: 'unlock', source: 'admin-early-unlock', date: dateKey }),
                store.saveSettingVerified(chatId, LOCK_STATE_KEY, { locked: false, at: Date.now(), source: 'admin-early-unlock' }),
                store.saveSettingVerified(chatId, LAST_ACTION_KEY, { action: 'unlock', time: getCurrentTimeString(), day, source: 'admin-early-unlock' })
            ]);
            if (writes.some(saved => !saved)) throw new Error('Could not persist early manual-unlock state.');
            await sock.sendMessage(chatId, { text: '🔓 *THE GROUP HAS BEEN UNLOCKED EARLY*\\n\\nAn admin has opened the group ahead of the scheduled unlock time. Today’s activities are now being posted.' });
            await sendDailyActivityOnce(sock, chatId, day);
            console.log(`[GroupLock] Detected admin early-unlock for ${chatId} - ${day}`);
        } catch (error) {
            console.error(`[GroupLock] Early manual-unlock handler failed for ${chatId}:`, error);
        } finally {
            earlyUnlockInFlight.delete(chatId);
        }
    }
}

/**
 * Called every ~15s by the scheduler engine
 */
async function runGroupLockSchedule(sock, chatId) {
    // Only run for groups with the Matured Minded lifecycle package.
    if (!await hasMaturedMindedFeatures(chatId)) return false;

    const retryAt = groupForbiddenUntil.get(chatId) || 0;
    if (retryAt > Date.now()) return false;
    if (retryAt) groupForbiddenUntil.delete(chatId);

    try {
        const day = getCurrentDay();
        const time = getCurrentTimeString();
        const schedules = await getGroupLockSchedule(chatId);
        const schedule = day === 'sunday' ? schedules.sunday : schedules.default;

        const state = (await store.getSetting(chatId, LOCK_STATE_KEY)) || { locked: false };
        const lastAction = (await store.getSetting(chatId, LAST_ACTION_KEY)) || {};
        const manualOverride = (await store.getSetting(chatId, MANUAL_OVERRIDE_KEY)) || {};

        const [lockH, lockM] = schedule.lock.split(':').map(Number);
        const [unlockH, unlockM] = schedule.unlock.split(':').map(Number);
        const now = getLagosNow();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const lockMinutes = lockH * 60 + lockM;
        const unlockMinutes = unlockH * 60 + unlockM;

        // Durable one-off lock: evaluated by this existing scheduler and restored from MongoDB.
        let quickLock = await store.getSetting(chatId, QUICK_LOCK_KEY);

        // A pending one-off lock owns this group's lifecycle until activation.
        // Do not let the recurring daily self-heal lock it before its requested time.
        const quickLockPending = quickLock?.status === 'scheduled' && Date.now() < Number(quickLock.startAt);

        if (quickLock?.status === 'scheduled' && Date.now() >= Number(quickLock.startAt)) {
            try {
                // Start the duration only after WhatsApp confirms the group was locked.
                await sock.groupSettingUpdate(chatId, 'announcement');
                const lockedAt = Date.now();
                quickLock = { ...quickLock, status: 'locked', lockedAt, endAt: lockedAt + Number(quickLock.durationMs) };
                await saveGroupSetting(chatId, QUICK_LOCK_KEY, quickLock);
                await saveGroupSetting(chatId, LOCK_STATE_KEY, { locked: true, at: lockedAt, source: 'quicklock' });
                await saveGroupSetting(chatId, LAST_ACTION_KEY, { action: 'lock', time: getCurrentTimeString(), day: getCurrentDay(), source: 'quicklock' });
                await sock.sendMessage(chatId, { text: '🔒 *One-off scheduled group lock is now active.*' });
            } catch (error) { console.error('[GroupLock] One-off quick lock failed for ' + chatId + ':', error.message); }
        }

        // Night window (e.g. 01:00 - 06:00)
        let shouldBeLocked = false;
        if (lockMinutes < unlockMinutes) {
            shouldBeLocked = nowMinutes >= lockMinutes && nowMinutes < unlockMinutes;
        } else {
            // crosses midnight (e.g. 01:00 lock, 12:00 unlock next day is handled by day)
            shouldBeLocked = nowMinutes >= lockMinutes || nowMinutes < unlockMinutes;
        }

        if (quickLock?.status === 'locked' && Date.now() >= Number(quickLock.endAt)) {
            const preserveDailyLock = (shouldBeLocked && manualOverride.day !== day) || (manualOverride.day === day && manualOverride.action === 'lock');
            try {
                if (!preserveDailyLock && !await unlockGroupSetting(sock, chatId)) throw new Error('WhatsApp rejected quick-lock expiry unlock.');
                await saveGroupSetting(chatId, QUICK_LOCK_KEY, { ...quickLock, status: 'completed', completedAt: Date.now(), completedWithDailyLockPreserved: preserveDailyLock });
                if (!preserveDailyLock) {
                    await saveGroupSetting(chatId, LOCK_STATE_KEY, { locked: false, at: Date.now(), source: 'quicklock-expiry' });
                    await saveGroupSetting(chatId, LAST_ACTION_KEY, { action: 'unlock', time: getCurrentTimeString(), day: getCurrentDay(), source: 'quicklock-expiry' });
                }
                state.locked = preserveDailyLock;
                await sock.sendMessage(chatId, { text: preserveDailyLock ? '🔒 *The one-off lock period has ended. The regular group lock remains active.*' : '🔓 *The one-off scheduled group lock has ended. The group is open again.*' });
            } catch (error) { console.error('[GroupLock] One-off quick-lock expiry failed for ' + chatId + ':', error.message); }
        }

        const oneOffLockActive = quickLock?.status === 'locked' && now.getTime() < Number(quickLock.endAt);

        // The daily activity is completely independent of lock state now:
        // as soon as we reach (or pass) today's unlock time, send+pin it
        // once. This runs even if the lock never succeeded, and even if
        // the bot was offline exactly at unlock time and only catches up
        // later (eg. after a restart).
        if (nowMinutes >= unlockMinutes) {
            await sendDailyActivityOnce(sock, chatId, day);
            // Keep the WhatsApp setting in sync with "should be unlocked"
            // unless an admin deliberately re-locked it after this time.
            if (!oneOffLockActive && state.locked && manualOverride.day !== day) {
                if (!await unlockGroupSetting(sock, chatId)) return false;
                await saveGroupSetting(chatId, LOCK_STATE_KEY, { locked: false, at: Date.now() });
            }
        }

        // A live one-off lock takes precedence over the recurring daily schedule.
        // Daily activity can still be published, but scheduled lock/unlock logic
        // must not cancel the timed lock before its persisted expiry.
        if (oneOffLockActive) return true;

        // Prevent double-firing the lock/unlock *messages* in the same minute
        const alreadyFiredThisMinute = lastAction.time === time && lastAction.day === day;

        // Lock at scheduled time (start of a fresh night - clears any
        // leftover manual-override flag from the previous day automatically
        // since we always compare against today's `day`).
        if (!quickLockPending && !alreadyFiredThisMinute && time === schedule.lock && !state.locked) {
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
        if (!quickLockPending && shouldBeLocked && !state.locked && manualOverride.day !== day) {
            await lockGroup(sock, chatId);
        }

    } catch (e) {
        if (!recordGroupLockFailure(chatId, 'scheduled lifecycle check', e)) {
            console.error(`[GroupLock] Scheduled lifecycle check failed for group ${chatId}:`, e);
        }
        return false;
    }
}

export async function checkGroupLockSchedule(sock, chatId) {
    return runScheduledGroupCheck(chatId, () => runGroupLockSchedule(sock, chatId));
}

export default {
    command: 'grouplock',
    aliases: ['lock', 'unlock', 'glock', 'quicklock'],
    category: 'admin',
    description: 'Manually lock/unlock the group and configure its automatic schedule',
    usage: '.grouplock [lock|unlock|status|schedule|set|reset|quicklock]',
    adminOnly: true,
    groupOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo } = context;
        const action = (args[0] || '').toLowerCase();

        if (!await hasMaturedMindedFeatures(chatId)) {
            return sock.sendMessage(chatId, {
                text: 'This command is enabled only in the authorized feature groups.'
            }, { quoted: message });
        }

        const quickLockArgs = action === 'quicklock'
            ? args.slice(1)
            : (['status', 'cancel'].includes(action) || parseQuickLockStartAt(action) ? args : null);
        if (quickLockArgs) {
            const subaction = String(quickLockArgs[0] || '').toLowerCase();
            const existing = await store.getSetting(chatId, QUICK_LOCK_KEY);
            if (subaction === 'status') {
                if (!existing || ['completed', 'cancelled'].includes(existing.status)) return sock.sendMessage(chatId, { text: 'No active one-off quick lock is scheduled.' }, { quoted: message });
                const start = new Date(existing.startAt).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' });
                const end = new Date(existing.endAt).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' });
                return sock.sendMessage(chatId, { text: '⏱️ *ONE-OFF QUICK LOCK*\nStatus: *' + existing.status + '*\nStarts: *' + start + '*\nEnds: *' + end + '*\nTimezone: Africa/Lagos' }, { quoted: message });
            }
            if (subaction === 'cancel') {
                if (!existing || !['scheduled', 'locked'].includes(existing.status)) return sock.sendMessage(chatId, { text: 'There is no pending or active quick lock to cancel.' }, { quoted: message });
                if (existing.status === 'locked') return sock.sendMessage(chatId, { text: 'This quick lock is already active. Use `.grouplock unlock` to open the group; cancellation will not silently override a live lock.' }, { quoted: message });
                await saveGroupSetting(chatId, QUICK_LOCK_KEY, { ...existing, status: 'cancelled', cancelledAt: Date.now() });
                return sock.sendMessage(chatId, { text: '✅ One-off quick lock cancelled.' }, { quoted: message });
            }
            const startAt = parseQuickLockStartAt(quickLockArgs[0]);
            const durationMs = parseQuickLockDuration(quickLockArgs[1]);
            if (!startAt || !durationMs) return sock.sendMessage(chatId, { text: 'Use `.grouplock quicklock 5pm 2h` or `.grouplock quicklock 17:00 90m`.\nAlso: `.grouplock quicklock status` and `.grouplock quicklock cancel`. Times use Africa/Lagos.' }, { quoted: message });
            if (existing && ['scheduled', 'locked'].includes(existing.status)) return sock.sendMessage(chatId, { text: 'A one-off quick lock is already pending or active. Check `.grouplock quicklock status` first.' }, { quoted: message });
            const record = { status: 'scheduled', startAt, endAt: startAt + durationMs, durationMs, createdAt: Date.now(), createdBy: context.senderId || '' };
            await saveGroupSetting(chatId, QUICK_LOCK_KEY, record);
            const start = new Date(startAt).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' });
            const end = new Date(startAt + durationMs).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' });
            return sock.sendMessage(chatId, { text: '✅ *ONE-OFF QUICK LOCK SCHEDULED*\nLock: *' + start + '*\nUnlock: *' + end + '*\nDuration: *' + Math.round(durationMs / 60000) + ' minutes*\nTimezone: Africa/Lagos\n\nThis is a one-time lock, separate from the recurring daily schedule.' }, { quoted: message });
        }

        if (action === 'schedule') {
            const schedules = await getGroupLockSchedule(chatId);
            return sock.sendMessage(chatId, { text: `🕒 *GROUP LOCK SCHEDULE*\\n\\nMonday–Saturday: Lock *${schedules.default.lock}* · Unlock *${schedules.default.unlock}*\\nSunday: Lock *${schedules.sunday.lock}* · Unlock *${schedules.sunday.unlock}*\\n\\nSet weekday schedule: *.grouplock set default 01:00 06:00*\\nSet Sunday schedule: *.grouplock set sunday 01:00 12:00*\\nRestore defaults: *.grouplock reset*`, ...channelInfo }, { quoted: message });
        }
        if (action === 'set') {
            const dayType = String(args[1] || 'default').toLowerCase();
            const lock = String(args[2] || '');
            const unlock = String(args[3] || '');
            if (!['default', 'sunday'].includes(dayType) || !validClock(lock) || !validClock(unlock) || lock === unlock) {
                return sock.sendMessage(chatId, { text: 'Use *.grouplock set default 01:00 06:00* or *.grouplock set sunday 01:00 12:00*. Times must use 24-hour HH:MM format and must differ.', ...channelInfo }, { quoted: message });
            }
            const schedules = await getGroupLockSchedule(chatId);
            schedules[dayType] = { lock, unlock };
            if (!await store.saveSettingVerified(chatId, GROUP_LOCK_SCHEDULE_KEY, schedules)) {
                return sock.sendMessage(chatId, { text: '❌ Could not save the group lock schedule. Existing schedule remains unchanged.', ...channelInfo }, { quoted: message });
            }
            return sock.sendMessage(chatId, { text: `✅ ${dayType === 'sunday' ? 'Sunday' : 'Monday–Saturday'} lock schedule updated.\\nLock: *${lock}*\\nUnlock: *${unlock}*\\n\\nThe scheduler will use the new times automatically.`, ...channelInfo }, { quoted: message });
        }
        if (action === 'reset') {
            if (!await store.saveSettingVerified(chatId, GROUP_LOCK_SCHEDULE_KEY, null)) {
                return sock.sendMessage(chatId, { text: '❌ Could not restore the default schedule.', ...channelInfo }, { quoted: message });
            }
            const schedules = await getGroupLockSchedule(chatId);
            return sock.sendMessage(chatId, { text: `✅ Default schedule restored.\\nMonday–Saturday: ${schedules.default.lock}–${schedules.default.unlock}\\nSunday: ${schedules.sunday.lock}–${schedules.sunday.unlock}`, ...channelInfo }, { quoted: message });
        }
        if (action === 'lock' || action === 'unlock') {
            const completed = await runScheduledGroupCheck(chatId, async () => {
                if (action === 'lock') {
                    const day = getCurrentDay();
                    await saveGroupSetting(chatId, MANUAL_OVERRIDE_KEY, { day, action: 'lock' });
                    return lockGroup(sock, chatId);
                }
                return unlockGroup(sock, chatId, { manual: true });
            });
            if (completed === false) {
                return sock.sendMessage(chatId, { text: '⏳ A group lock operation is already running. Please retry in a moment.' }, { quoted: message });
            }
            return;
        }

        const day = getCurrentDay();
        const time = getCurrentTimeString();
        const schedules = await getGroupLockSchedule(chatId);
        const schedule = day === 'sunday' ? schedules.sunday : schedules.default;
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
