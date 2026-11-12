import store from './lightweight_store.js';

export const BIRTHDAY_KEY = 'forgeBirthdayRegistry';
export const BIRTHDAY_TIME_ZONE = 'Africa/Lagos';
export const BIRTHDAY_HOUR = 8;
const RETRY_AFTER_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 3;

export function normalizeBirthdayUserId(jid) {
    return String(jid || '').split(':')[0].split('@')[0].trim();
}

export function parseBirthdayDate(input) {
    const match = String(input || '').trim().match(/^(\d{1,2})[/.\-](\d{1,2})$/);
    if (!match) return null;
    const day = Number(match[1]);
    const month = Number(match[2]);
    const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) return null;
    return { day, month };
}

export function formatBirthdayDate(date) {
    if (!date?.day || !date?.month) return '';
    return `${String(date.day).padStart(2, '0')}/${String(date.month).padStart(2, '0')}`;
}

export function getLagosDateParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: BIRTHDAY_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return {
        year: Number(values.year),
        month: Number(values.month),
        day: Number(values.day),
        hour: Number(values.hour),
        minute: Number(values.minute)
    };
}

export async function loadBirthdayRegistry() {
    const saved = await store.getSetting('global', BIRTHDAY_KEY);
    if (saved && typeof saved === 'object' && !Array.isArray(saved) && saved.users && typeof saved.users === 'object') {
        return saved;
    }
    return { users: {} };
}

export async function saveBirthdayRegistry(registry) {
    const saved = await store.saveSettingVerified('global', BIRTHDAY_KEY, registry);
    if (!saved) throw new Error('Birthday registration could not be saved safely. Please try again.');
    return true;
}

function deliveryState(record, year, channel, destination) {
    if (!record.deliveries) record.deliveries = {};
    if (!record.deliveries[year]) record.deliveries[year] = { groups: {}, dm: {} };
    if (!record.deliveries[year][channel]) record.deliveries[year][channel] = {};
    return record.deliveries[year][channel][destination] || null;
}

function canAttempt(state, now) {
    if (!state) return true;
    if (state.status === 'sent' || state.status === 'sending') return false;
    if ((state.attempts || 0) >= MAX_ATTEMPTS) return false;
    return !state.lastAttemptAt || now - state.lastAttemptAt >= RETRY_AFTER_MS;
}

function birthdayText(name, mentionJid = null) {
    const safeName = String(name || 'our celebrant').replace(/[\r\n@]/g, ' ').trim().slice(0, 50) || 'our celebrant';
    const greetingName = mentionJid ? `@${mentionJid.split('@')[0].split(':')[0]}` : safeName.toUpperCase();
    return `🎉🎂 *HAPPY BIRTHDAY, ${greetingName}!* 🥳❤️

Today, we celebrate you! May this new chapter bring greater opportunities, genuine happiness, beautiful wins and plenty of reasons to smile.

Keep growing, keep shining and keep giving us reasons to celebrate you. ✨

Have an amazing birthday! And please, don't forget to share the cake. Forge Guard is watching. 👀😂

🎊🎁 *HAPPY BIRTHDAY!* `;
}

/**
 * One daily pass, called by the existing scheduler. Group greetings are batched
 * by group so a group with several celebrants receives one tagged message.
 * "sending" is persisted before delivery to prevent duplicate sends after a
 * process restart; known failures are retried at most three times, 15 minutes apart.
 */
export async function checkBirthdayGreetings(sock, now = new Date()) {
    const local = getLagosDateParts(now);
    if (local.hour < BIRTHDAY_HOUR) return { skipped: 'before-delivery-time' };

    const registry = await loadBirthdayRegistry();
    const users = Object.entries(registry.users);
    const due = users.filter(([, record]) =>
        record?.birthday?.day === local.day && record?.birthday?.month === local.month
    );
    if (!due.length) return { groupsSent: 0, dmsSent: 0 };

    const yearKey = String(local.year);
    const groups = new Map();
    for (const [userId, record] of due) {
        for (const [chatId, mentionJid] of Object.entries(record.groups || {})) {
            if (!chatId.endsWith('@g.us') || !mentionJid) continue;
            const state = deliveryState(record, yearKey, 'groups', chatId);
            if (!canAttempt(state, now.getTime())) continue;
            if (state?.status === 'sending') continue;
            if (!groups.has(chatId)) groups.set(chatId, []);
            groups.get(chatId).push({ userId, record, mentionJid, state });
        }
    }

    let groupsSent = 0;
    for (const [chatId, celebrants] of groups) {
        const mentions = [...new Set(celebrants.map(item => item.mentionJid))];
        for (const item of celebrants) {
            if (!item.record.deliveries) item.record.deliveries = {};
            if (!item.record.deliveries[yearKey]) item.record.deliveries[yearKey] = { groups: {}, dm: {} };
            if (!item.record.deliveries[yearKey].groups) item.record.deliveries[yearKey].groups = {};
            item.record.deliveries[yearKey].groups[chatId] = {
                status: 'sending',
                attempts: (item.state?.attempts || 0) + 1,
                lastAttemptAt: now.getTime()
            };
        }
        await saveBirthdayRegistry(registry);
        const lines = celebrants.map(item => `🎂 @${item.mentionJid.split('@')[0].split(':')[0]} — ${String(item.record.name || 'Member').replace(/[\r\n@]/g, ' ').trim().slice(0, 50)}`).join('\n');
        const names = celebrants.map(item => String(item.record.name || 'our celebrant').replace(/[\r\n@]/g, ' ').trim().slice(0, 50));
        const text = celebrants.length === 1
            ? birthdayText(names[0], celebrants[0].mentionJid)
            : `🎉🎂 *TODAY WE HAVE BIRTHDAY CELEBRATIONS!* 🥳❤️\n\n${lines}\n\nWishing you all a new year filled with happiness, growth, beautiful wins and unforgettable moments. Keep shining! ✨\n\nAnd yes, cake is expected. Forge Guard is watching. 👀😂\n\n🎊🎁 *HAPPY BIRTHDAY!* `;
        try {
            await sock.sendMessage(chatId, { text, mentions });
        } catch (error) {
            for (const item of celebrants) {
                item.record.deliveries[yearKey].groups[chatId] = {
                    status: 'failed',
                    attempts: (item.state?.attempts || 0) + 1,
                    lastAttemptAt: now.getTime(),
                    error: String(error?.message || 'send failed').slice(0, 160)
                };
            }
            await saveBirthdayRegistry(registry);
            console.error(`[BIRTHDAY] Group greeting failed for ${chatId}:`, error.message);
            continue;
        }
        for (const item of celebrants) {
            item.record.deliveries[yearKey].groups[chatId] = {
                status: 'sent',
                attempts: (item.state?.attempts || 0) + 1,
                lastAttemptAt: now.getTime(),
                sentAt: now.getTime()
            };
        }
        await saveBirthdayRegistry(registry);
        groupsSent++;
    }

    let dmsSent = 0;
    for (const [userId, record] of due) {
        const dm = record.dm;
        if (!dm?.enabled || !dm?.jid || dm.jid.endsWith('@g.us')) continue;
        const state = deliveryState(record, yearKey, 'dm', userId);
        if (!canAttempt(state, now.getTime()) || state?.status === 'sending') continue;
        record.deliveries ||= {};
        if (!record.deliveries[yearKey]) record.deliveries[yearKey] = { groups: {}, dm: {} };
        if (!record.deliveries[yearKey].dm) record.deliveries[yearKey].dm = {};
        record.deliveries[yearKey].dm[userId] = {
            status: 'sending',
            attempts: (state?.attempts || 0) + 1,
            lastAttemptAt: now.getTime()
        };
        await saveBirthdayRegistry(registry);
        try {
            await sock.sendMessage(dm.jid, { text: birthdayText(record.name) });
        } catch (error) {
            record.deliveries[yearKey].dm[userId] = {
                status: 'failed',
                attempts: (state?.attempts || 0) + 1,
                lastAttemptAt: now.getTime(),
                error: String(error?.message || 'send failed').slice(0, 160)
            };
            await saveBirthdayRegistry(registry);
            console.error(`[BIRTHDAY] Private greeting failed for ${userId}:`, error.message);
            continue;
        }
        record.deliveries[yearKey].dm[userId] = {
            status: 'sent',
            attempts: (state?.attempts || 0) + 1,
            lastAttemptAt: now.getTime(),
            sentAt: now.getTime()
        };
        await saveBirthdayRegistry(registry);
        dmsSent++;
    }

    return { groupsSent, dmsSent, due: due.length };
}
