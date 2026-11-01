/**
 * Day-lock for scheduled group games and temporary admin bypasses.
 * Days use Africa/Lagos local time: Sunday=0 ... Saturday=6.
 */
import store from '../lib/lightweight_store.js';

const BYPASS_KEY = 'gameBypass';
const GAME_DAYS = { basket: [2], wcw: [3], hotseat: [5], anonymous: [6], tod: [0] };
const GAME_NAMES = {
  basket: "Devil's Basket",
  wcw: 'Women Crush Wednesday',
  hotseat: 'Hot Seat',
  anonymous: 'Anonymous Night',
  tod: 'Truth or Dare'
};
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const VALID_GAMES = Object.keys(GAME_DAYS);

export function getLagosDay(date = new Date()) {
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Lagos', weekday: 'short' }).format(date);
  return ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 })[day];
}
async function getBypasses(chatId) {
  return (await store.getSetting(chatId, BYPASS_KEY)) || {};
}
async function saveBypasses(chatId, data) {
  await store.saveSetting(chatId, BYPASS_KEY, data);
}
export async function isGameAllowed(chatId, gameKey) {
  const allowedDays = GAME_DAYS[gameKey];
  if (!allowedDays) return { ok: true };
  const bypasses = await getBypasses(chatId);
  const bp = bypasses[gameKey];
  if (bp && Number(bp.until) > Date.now()) return { ok: true, bypass: true };
  if (bp) {
    delete bypasses[gameKey];
    await saveBypasses(chatId, bypasses);
  }
  if (allowedDays.includes(getLagosDay())) return { ok: true };
  const names = allowedDays.map(day => DAY_NAMES[day]).join('/');
  return {
    ok: false,
    msg: `⏳ *${GAME_NAMES[gameKey] || gameKey}* only runs on *${names}*.\n\nAsk an admin to bypass:\n.bypass ${gameKey} 1h`
  };
}
function parseDuration(value) {
  const match = String(value || '').trim().match(/^(\d+)\s*(m|min|h|hour|hours)?$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isSafeInteger(amount) || amount <= 0) return null;
  return match[2]?.toLowerCase().startsWith('m') ? amount * 60_000 : amount * 3_600_000;
}
export default {
  command: 'bypass',
  aliases: ['gamebypass'],
  category: 'admin',
  description: 'Temporarily allow or restore the schedule for a day-locked game.',
  usage: '.bypass <game> <duration> | .bypass off <game> | .bypass <game> off',
  groupOnly: true,
  adminOnly: true,
  async handler(sock, message, args, context) {
    const { chatId, channelInfo } = context;
    let game = (args[0] || '').toLowerCase();
    let action = (args[1] || '').toLowerCase();

    // Accept both advertised forms: .bypass off <game> and .bypass <game> off.
    if (game === 'off') {
      game = action;
      action = 'off';
    }
    if (!VALID_GAMES.includes(game)) {
      return sock.sendMessage(chatId, {
        text: `*Day-lock bypass*\n\nGames: ${VALID_GAMES.join(' | ')}\n\nExamples:\n.bypass basket 2h\n.bypass wcw 30m\n.bypass off basket\n.bypass tod off`,
        ...channelInfo
      }, { quoted: message });
    }

    const bypasses = await getBypasses(chatId);
    if (action === 'off') {
      const existed = Boolean(bypasses[game]);
      delete bypasses[game];
      await saveBypasses(chatId, bypasses);
      return sock.sendMessage(chatId, {
        text: existed
          ? `✅ Bypass cleared for *${GAME_NAMES[game]}*. Its normal day-lock is active again.`
          : `ℹ️ No active bypass was set for *${GAME_NAMES[game]}*. Its normal schedule remains in force.`,
        ...channelInfo
      }, { quoted: message });
    }

    const ms = parseDuration(action || '1h');
    if (!ms) {
      return sock.sendMessage(chatId, { text: 'Invalid duration. Use a positive value such as *30m*, *2h* or *1h*.', ...channelInfo }, { quoted: message });
    }
    bypasses[game] = { until: Date.now() + ms, setAt: Date.now() };
    await saveBypasses(chatId, bypasses);
    const minutes = Math.round(ms / 60_000);
    return sock.sendMessage(chatId, {
      text: `✅ *${GAME_NAMES[game]}* unlocked for *${minutes} minutes*.\n\nThe normal day-lock returns automatically when the bypass expires.`,
      ...channelInfo
    }, { quoted: message });
  }
};
