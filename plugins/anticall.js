import store from '../lib/lightweight_store.js';
import fs from 'fs';
import { shouldBlockCaller, getAnticallOverride } from '../lib/anticallAccess.js';

const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);
const ANTICALL_PATH = './data/anticall.json';

async function readState() {
  try {
    let settings;
    if (HAS_DB) {
      settings = await store.getSetting('global', 'anticall');
    } else {
      if (!fs.existsSync(ANTICALL_PATH)) return { enabled: false, users: {} };
      settings = JSON.parse(fs.readFileSync(ANTICALL_PATH, 'utf8') || '{}');
    }
    if (typeof settings === 'boolean') settings = { enabled: settings };
    if (!settings || typeof settings !== 'object') settings = {};
    return { enabled: settings.enabled === true, users: settings.users && typeof settings.users === 'object' ? settings.users : {} };
  } catch {
    return { enabled: false, users: {} };
  }
}

async function writeState(nextState) {
  const state = typeof nextState === 'boolean'
    ? { ...(await readState()), enabled: nextState }
    : { enabled: nextState?.enabled === true, users: nextState?.users && typeof nextState.users === 'object' ? nextState.users : {} };
  try {
    if (HAS_DB) {
      if (!await store.saveSettingVerified('global', 'anticall', state)) throw new Error('Anticall settings could not be verified.');
    } else {
      if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
      fs.writeFileSync(ANTICALL_PATH, JSON.stringify(state, null, 2));
    }
    return true;
  } catch (error) {
    console.error('Error writing anticall state:', error);
    return false;
  }
}

function parseNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15 ? digits : null;
}

export default {
  command: 'anticall',
  aliases: ['acall', 'callblock'],
  category: 'owner',
  description: 'Control universal and individual incoming-call blocking.',
  usage: '.anticall on/off/status | .anticall on/off/status <phone number>',
  strictOwnerOnly: true,
  async handler(sock, message, args, context) {
    const chatId = context.chatId || message.key.remoteJid;
    const [rawAction = 'help', rawTarget] = args || [];
    const action = String(rawAction).toLowerCase();
    const state = await readState();

    if (!['on', 'off', 'status'].includes(action)) {
      return sock.sendMessage(chatId, {
        text: '*📵 ANTICALL CONTROLS*\n\n.anticall on/off/status — universal switch\n.anticall on/off/status <number> — individual caller\n\nAn individual setting overrides the universal switch. Only the creator/bot number can change these settings.'
      }, { quoted: message });
    }

    if (rawTarget) {
      const number = parseNumber(rawTarget);
      if (!number) {
        return sock.sendMessage(chatId, { text: '❌ Enter a valid phone number with country code, e.g. .anticall off 2348012345678' }, { quoted: message });
      }
      if (action !== 'status') {
        state.users[number] = action === 'on';
        if (!await writeState(state)) {
          return sock.sendMessage(chatId, { text: '❌ Could not save the individual AntiCall setting.' }, { quoted: message });
        }
      }
      const personal = state.users[number];
      const effective = typeof personal === 'boolean' ? personal : state.enabled;
      return sock.sendMessage(chatId, {
        text: `📵 *ANTICALL — ${number}*\n\nIndividual setting: ${typeof personal === 'boolean' ? (personal ? '🟢 ON' : '🔴 OFF') : 'INHERIT'}\nEffective blocking: ${effective ? '🟢 ON' : '🔴 OFF'}\nUniversal switch: ${state.enabled ? 'ON' : 'OFF'}`
      }, { quoted: message });
    }

    if (action !== 'status') {
      state.enabled = action === 'on';
      if (!await writeState(state)) {
        return sock.sendMessage(chatId, { text: '❌ Could not save the universal AntiCall setting.' }, { quoted: message });
      }
    }
    return sock.sendMessage(chatId, {
      text: `🌐 *UNIVERSAL ANTICALL*\n\nStatus: ${state.enabled ? '🟢 ON' : '🔴 OFF'}\nIndividual overrides: ${Object.keys(state.users).length}\n\nUse .anticall on/off <number> to control one caller independently.`
    }, { quoted: message });
  },
  readState,
  writeState,
  shouldBlockCaller,
  getAnticallOverride
};
