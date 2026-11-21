import store from '../lib/lightweight_store.js';

const SETTING_KEY = 'creatorBoundaryReplies';
const REPLY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MAX_COOLDOWN_ENTRIES = 5000;
const MAX_SETTINGS_CACHE_ENTRIES = 150;
const settingsCache = new Map();
const cooldowns = new Map();

// A deliberately neutral, low-friction boundary bank. No insults, accusations,
// sexual references, or language inviting other members to pile on.
export const BOUNDARY_REPLY_BANK = [
  'I’m keeping this one brief. Let’s keep the group moving.',
  'Noted. I’m going to leave this conversation there.',
  'I’ll sit this one out. Everyone else, carry on.',
  'Message received. Let’s move along, please.',
  'I’m choosing peace and a shorter conversation today.',
  'No long discussion from me on this one. Next topic.',
  'I’ll pass on the back-and-forth. Carry on, everyone.',
  'Keeping things calm over here. Let’s move forward.',
  'That’s enough from my side. On to the next thing.',
  'I’m not opening a side conversation today. Carry on.',
  'Let’s keep the chat focused and moving.',
  'I’ll leave that there. What’s next, people?',
  'Short response, peaceful intentions. Let’s move on.',
  'I’m taking the quiet route on this conversation.',
  'No extra commentary from me. Group, please continue.',
  'Let’s not turn this into a whole episode.',
  'I’m keeping my notifications and my replies minimal.',
  'Acknowledged. I’ll let the conversation move on.',
  'No debate scheduled on my side today.',
  'I’m going to keep this interaction brief and respectful.',
  'Let’s give the timeline a chance to breathe.',
  'I’ll pass the microphone back to the group.',
  'No follow-up needed from me. Carry on.',
  'Keeping the peace is today’s agenda.',
  'I’m choosing not to extend this thread.',
  'That’s my cue to keep scrolling. Next topic.',
  'Let’s leave room for the rest of the group.',
  'I’ll keep it moving rather than make a scene.',
  'Nothing more to add from me. Carry on.',
  'Let’s keep this chat useful and uncomplicated.',
  'I’m staying out of the extended conversation.',
  'A brief acknowledgement, then back to business.',
  'I’ll leave this thread right here.',
  'No extra rounds from me. Let’s move forward.',
  'Keeping the temperature low and the chat moving.',
  'I’m not adding another chapter to this one.',
  'Let’s save the group’s energy for the next topic.',
  'I’ll keep my reply short and let everyone continue.',
  'Peaceful exit from this thread. Carry on.',
  'I’m leaving space for a fresh topic.',
  'No need to stretch this conversation. Next.',
  'I’ll keep things simple and move along.',
  'This is where I step back from the thread.',
  'I’m keeping the chat tidy. Let’s continue.',
  'No side quest from me today. Back to the group.',
  'I’ll leave the conversation there, respectfully.',
  'Let’s keep the focus on what brought everyone here.',
  'I’m choosing a quiet response and a quick pivot.',
  'That’s all from me on this thread.',
  'I’ll let this one pass without a long exchange.',
  'Keeping it calm, brief, and moving forward.',
  'I’m stepping back from this particular conversation.',
  'No need for a long exchange here. Carry on.',
  'Let’s move to something that needs the group’s attention.',
  'I’ll keep the response short and the atmosphere easy.',
  'Consider this my polite pivot to the next topic.',
  'I’m not extending this thread, but the group can continue.',
  'A calm acknowledgement is all I have for this one.',
  'Let’s keep the chat welcoming and on track.',
  'I’ll leave it there and give the group the floor.'
];

function cleanJid(value) {
  return typeof value === 'string' ? value.trim().split(':')[0] : '';
}

function quotedParticipant(message) {
  const context = message?.message?.extendedTextMessage?.contextInfo
    || message?.message?.imageMessage?.contextInfo
    || message?.message?.videoMessage?.contextInfo;
  return cleanJid(context?.participant || '');
}

async function readSettings(chatId) {
  if (settingsCache.has(chatId)) return settingsCache.get(chatId);
  const saved = await store.getSetting(chatId, SETTING_KEY).catch(() => null);
  const value = saved && typeof saved === 'object'
    ? { enabled: saved.enabled === true, target: cleanJid(saved.target) }
    : { enabled: false, target: '' };
  settingsCache.set(chatId, value);
  while (settingsCache.size > MAX_SETTINGS_CACHE_ENTRIES) {
    settingsCache.delete(settingsCache.keys().next().value);
  }
  return value;
}

async function saveSettings(chatId, value) {
  const safe = { enabled: value.enabled === true, target: cleanJid(value.target) };
  settingsCache.set(chatId, safe);
  while (settingsCache.size > MAX_SETTINGS_CACHE_ENTRIES) {
    settingsCache.delete(settingsCache.keys().next().value);
  }
  await store.saveSetting(chatId, SETTING_KEY, safe);
  return safe;
}

function pickBoundaryReply(random = Math.random) {
  return BOUNDARY_REPLY_BANK[Math.floor(random() * BOUNDARY_REPLY_BANK.length)];
}

export async function handleCreatorBoundaryReply(sock, chatId, message, senderId) {
  if (!chatId?.endsWith('@g.us') || message?.key?.fromMe) return false;
  const sender = cleanJid(senderId || message?.key?.participant);
  if (!sender) return false;

  try {
    const settings = await readSettings(chatId);
    if (!settings.enabled || !settings.target || sender !== settings.target) return false;

    const now = Date.now();
    const cooldownKey = chatId + ':' + sender;
    if (now < (cooldowns.get(cooldownKey) || 0)) return false;
    cooldowns.set(cooldownKey, now + REPLY_COOLDOWN_MS);
    while (cooldowns.size > MAX_COOLDOWN_ENTRIES) {
      cooldowns.delete(cooldowns.keys().next().value);
    }

    await sock.sendMessage(chatId, { text: pickBoundaryReply() }, { quoted: message });
    return true;
  } catch (error) {
    console.error('[CREATOR-BOUNDARY] Reply handler failed:', error?.message || error);
    return false;
  }
}

export default {
  command: 'blacklist',
  aliases: ['boundaryreply'],
  category: 'owner',
  description: 'Manage the creator-controlled group boundary reply rule',
  usage: '.blacklist <set|on|off|status|remove>',
  groupOnly: true,
  strictOwnerOnly: true,
  cooldown: 1000,
  async handler(sock, message, args, context) {
    const chatId = context.chatId || message.key.remoteJid;
    const action = String(args[0] || 'status').toLowerCase();
    const current = await readSettings(chatId);

    if (action === 'set') {
      const target = quotedParticipant(message);
      if (!target) {
        return sock.sendMessage(chatId, {
          text: 'Reply directly to the member’s message with `.blacklist set`. Only the creator can set the target.'
        }, { quoted: message });
      }
      await saveSettings(chatId, { enabled: false, target });
      return sock.sendMessage(chatId, {
        text: 'Target saved for this group. The rule is OFF by default. Use `.blacklist on` when you want to enable it.'
      }, { quoted: message });
    }

    if (action === 'on' || action === 'enable') {
      if (!current.target) {
        return sock.sendMessage(chatId, {
          text: 'No target is set. Reply to that member’s message with `.blacklist set` first.'
        }, { quoted: message });
      }
      await saveSettings(chatId, { ...current, enabled: true });
      return sock.sendMessage(chatId, {
        text: 'Creator boundary replies are ON for this group. The reply bank is rate-limited to one response per target per 24 hours.'
      }, { quoted: message });
    }

    if (action === 'off' || action === 'disable') {
      await saveSettings(chatId, { ...current, enabled: false });
      return sock.sendMessage(chatId, { text: 'Creator boundary replies are OFF for this group.' }, { quoted: message });
    }

    if (action === 'remove' || action === 'clear') {
      await saveSettings(chatId, { enabled: false, target: '' });
      cooldowns.delete(chatId + ':' + current.target);
      return sock.sendMessage(chatId, { text: 'Target removed and the rule switched OFF for this group.' }, { quoted: message });
    }

    if (action === 'status') {
      return sock.sendMessage(chatId, {
        text: '*CREATOR BOUNDARY REPLIES*\n\n' +
          '*Status:* ' + (current.enabled ? 'ON' : 'OFF') + '\n' +
          '*Target:* ' + (current.target ? 'configured' : 'not set') + '\n' +
          '*Reply bank:* ' + BOUNDARY_REPLY_BANK.length + ' fixed replies\n' +
          '*Cooldown:* 24 hours per target\n\n' +
          'Commands: `.blacklist set` (reply to a message), `.blacklist on`, `.blacklist off`, `.blacklist status`, `.blacklist remove`'
      }, { quoted: message });
    }

    return sock.sendMessage(chatId, {
      text: 'Use: `.blacklist set|on|off|status|remove`'
    }, { quoted: message });
  }
};
