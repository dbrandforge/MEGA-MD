/**
 * Day-lock for games + timed admin bypass
 *
 * Games:
 *  basket → Tuesday
 *  wcw → Wednesday
 *  hotseat → Friday
 *  anonymous → Saturday
 *  tod → Sunday (truth/dare focus)
 */
import store from '../lib/lightweight_store.js';

const BYPASS_KEY = 'gameBypass';

const GAME_DAYS = {
    basket: [2],       // Tuesday
    wcw: [3],          // Wednesday
    hotseat: [5],      // Friday
    anonymous: [6],    // Saturday
    tod: [0]           // Sunday
};

const GAME_NAMES = {
    basket: "Devil's Basket",
    wcw: 'Women Crush Wednesday',
    hotseat: 'Hot Seat',
    anonymous: 'Anonymous Night',
    tod: 'Truth or Dare'
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getLagosDay() {
    const str = new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' });
    return new Date(str).getDay();
}

async function getBypasses(chatId) {
    return (await store.getSetting(chatId, BYPASS_KEY)) || {};
}

async function saveBypasses(chatId, data) {
    await store.saveSetting(chatId, BYPASS_KEY, data);
}

export async function isGameAllowed(chatId, gameKey) {
    const day = getLagosDay();
    const allowedDays = GAME_DAYS[gameKey];
    if (!allowedDays) return { ok: true };

    // Check bypass
    const bypasses = await getBypasses(chatId);
    const bp = bypasses[gameKey];
    if (bp && bp.until > Date.now()) {
        return { ok: true, bypass: true };
    }
    // Clean expired
    if (bp && bp.until <= Date.now()) {
        delete bypasses[gameKey];
        await saveBypasses(chatId, bypasses);
    }

    if (allowedDays.includes(day)) return { ok: true };

    const names = allowedDays.map(d => DAY_NAMES[d]).join('/');
    return {
        ok: false,
        msg: `⏳ *${GAME_NAMES[gameKey] || gameKey}* only runs on *${names}*.\n\nAsk an admin to bypass:\n.bypass ${gameKey} 1h`
    };
}

function parseDuration(str) {
    const m = String(str || '').trim().match(/^(\d+)\s*(m|h|min|hour|hours)?$/i);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    const unit = (m[2] || 'h').toLowerCase();
    if (unit.startsWith('m')) return n * 60 * 1000;
    return n * 60 * 60 * 1000;
}

export default {
    command: 'bypass',
    aliases: ['gamebypass'],
    category: 'admin',
    description: 'Temporarily allow a day-locked game',
    usage: '.bypass <game> <duration> | .bypass off <game>',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo } = context;
        const game = (args[0] || '').toLowerCase();
        const durOrOff = (args[1] || '').toLowerCase();

        const valid = ['basket', 'wcw', 'hotseat', 'anonymous', 'tod'];
        if (!valid.includes(game)) {
            return sock.sendMessage(chatId, {
                text: `*Day-lock bypass*\n\nGames: basket | wcw | hotseat | anonymous | tod\n\nExamples:\n.bypass basket 2h\n.bypass wcw 30m\n.bypass off basket`,
                ...channelInfo
            }, { quoted: message });
        }

        const bypasses = await getBypasses(chatId);

        if (durOrOff === 'off' || game === 'off') {
            delete bypasses[game];
            await saveBypasses(chatId, bypasses);
            return sock.sendMessage(chatId, {
                text: `✅ Bypass cleared for *${GAME_NAMES[game]}*. Day-lock is active again.`,
                ...channelInfo
            }, { quoted: message });
        }

        const ms = parseDuration(durOrOff || '1h');
        if (!ms) {
            return sock.sendMessage(chatId, {
                text: 'Duration example: *30m* or *2h*',
                ...channelInfo
            }, { quoted: message });
        }

        bypasses[game] = { until: Date.now() + ms, setAt: Date.now() };
        await saveBypasses(chatId, bypasses);

        const mins = Math.round(ms / 60000);
        await sock.sendMessage(chatId, {
            text: `✅ *${GAME_NAMES[game]}* unlocked for *${mins} minutes*.\n\nDay-lock returns automatically after that.`,
            ...channelInfo
        }, { quoted: message });
    }
};
