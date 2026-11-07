import { loadUserGroupData, saveUserGroupData } from './chatbot.js';

function cleanPhone(value) {
  return String(value || '').split('@')[0].split(':')[0].replace(/\D/g, '');
}

function parseTargetNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return `${digits}@s.whatsapp.net`;
}

function isBotChat(chatId, sock) {
  const botNumber = String(sock.user?.id || '').split(':')[0].split('@')[0].replace(/\D/g, '');
  return Boolean(botNumber && cleanPhone(chatId) === botNumber);
}

function findOverride(data, targetJid) {
  const entries = Object.entries(data.chatbotDM || {});
  const targetNumber = cleanPhone(targetJid);
  for (const [jid, enabled] of entries) {
    if (jid === targetJid) return enabled;
    const savedNumber = jid.includes('@lid') ? '' : cleanPhone(jid);
    if (savedNumber && targetNumber && savedNumber === targetNumber) return enabled;
  }
  return undefined;
}

export default {
  command: 'dmchat',
  aliases: ['dmreply', 'privatechatbot'],
  category: 'owner',
  description: 'Control the universal and individual DM chatbot switches.',
  usage: '.dmchat all on/off/status | .dmchat on/off/status [phone number]',
  strictOwnerOnly: true,
  async handler(sock, message, args, context) {
    const chatId = context.chatId || message.key.remoteJid;
    const parts = (args || []).map(value => String(value).trim()).filter(Boolean);
    let scope = (parts[0] || '').toLowerCase();
    let action = (parts[1] || '').toLowerCase();
    let targetArg = parts[1];

    if (['on', 'off', 'status'].includes(scope)) {
      action = scope;
      targetArg = parts[1];
      scope = 'person';
    } else if (['all', 'global', 'universal'].includes(scope)) {
      action = (parts[1] || 'status').toLowerCase();
      scope = 'all';
    } else if (!scope) {
      scope = 'person';
      action = 'status';
    } else {
      return sock.sendMessage(chatId, {
        text: '*DM CHATBOT CONTROLS*\n\n.dmchat all on/off/status — universal default\n.dmchat on/off/status — this DM\n.dmchat on/off/status <number> — one person\n\nIndividual choices override the universal default.'
      }, { quoted: message });
    }

    if (!['on', 'off', 'status'].includes(action)) {
      return sock.sendMessage(chatId, {
        text: 'Usage: .dmchat all on/off/status | .dmchat on/off/status [phone number]'
      }, { quoted: message });
    }

    const data = await loadUserGroupData();
    if (!data.chatbotDM || typeof data.chatbotDM !== 'object') data.chatbotDM = {};

    if (scope === 'all') {
      if (action !== 'status') {
        data.chatbotDMEnabled = action === 'on';
        await saveUserGroupData(data);
      }
      const enabled = data.chatbotDMEnabled === true;
      return sock.sendMessage(chatId, {
        text: `🌐 *UNIVERSAL DM CHATBOT*\n\nDefault for people without an individual setting: ${enabled ? '🟢 ON' : '🔴 OFF'}\n\nIndividual overrides are preserved.\nUse .dmchat on/off <number> to control one person.`
      }, { quoted: message });
    }

    let targetJid = null;
    if (targetArg) {
      targetJid = parseTargetNumber(targetArg);
      if (!targetJid) {
        return sock.sendMessage(chatId, { text: '❌ Enter a valid phone number with country code, e.g. .dmchat on 2348012345678' }, { quoted: message });
      }
    } else if (chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: 'In a group, include the person’s phone number. Example: .dmchat on 2348012345678' }, { quoted: message });
    } else if (isBotChat(chatId, sock)) {
      return sock.sendMessage(chatId, { text: 'This is the bot’s own chat. Add the person’s number: .dmchat on 2348012345678' }, { quoted: message });
    } else {
      targetJid = chatId;
    }

    if (action !== 'status') {
      data.chatbotDM[targetJid] = action === 'on';
      await saveUserGroupData(data);
    }

    const override = findOverride(data, targetJid);
    const effective = typeof override === 'boolean' ? override : data.chatbotDMEnabled === true;
    const source = typeof override === 'boolean' ? 'individual override' : 'universal default';
    const targetLabel = targetJid.split('@')[0];
    return sock.sendMessage(chatId, {
      text: `👤 *DM CHATBOT — ${targetLabel}*\n\nIndividual setting: ${typeof override === 'boolean' ? (override ? '🟢 ON' : '🔴 OFF') : 'INHERIT'}\nEffective access: ${effective ? '🟢 ON' : '🔴 OFF'}\nSource: ${source}\n\n${action === 'status' ? 'No setting changed.' : `Individual DM chatbot switched ${action.toUpperCase()}.`}`
    }, { quoted: message });
  }
};
