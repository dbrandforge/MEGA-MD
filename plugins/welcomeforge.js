import store from '../lib/lightweight_store.js';
import isAdmin from '../lib/isAdmin.js';
import {
  WELCOME_PACK_SETTING,
  DEFAULT_WELCOME_PACK_MESSAGES,
  normalizeWelcomePackConfig
} from '../lib/groupWelcomePack.js';

function usage() {
  return [
    '*FORGE GUARD — WELCOME PACK*',
    '',
    '• .welcomeforge on/off',
    '• .welcomeforge status',
    '• .welcomeforge edit 1 <message>',
    '• .welcomeforge edit 2 <message>',
    '• .welcomeforge ',
    '• .welcomeforge reset 1|2',
    '',
    'Message 1 contains the introduction guidelines and tags new members.',
    'Message 2 contains the group welcome, concise rules and daily activity.',
    'Use {user} in either message to insert all new-member mentions.',
    'Use {daily_activity} in message 2 to insert the current daily activity.',
    '',
    'Changes affect this group only. The welcome-pack switch does not disable other group features.'
  ].join('\n');
}

export default {
  command: 'welcomeforge',
  aliases: ['welcomepack', 'wpack'],
  category: 'admin',
  description: 'Manage this group’s independent two-message welcome pack.',
  usage: '.welcomeforge on/off/status/edit/reset',
  groupOnly: true,
  adminOnly: false,
  async handler(sock, message, args, context) {
    const chatId = context.chatId || message.key.remoteJid;
    const senderId = context.senderId || message.key.participant || chatId;
    const senderAdmin = context.isSenderAdmin || (await isAdmin(sock, chatId, senderId)).isSenderAdmin;
    if (!context.isCreatorOrBot && !context.senderIsOwnerOrSudo && !senderAdmin) {
      return sock.sendMessage(chatId, { text: '🔒 Only this group’s creator or an authorized group admin can manage its welcome pack.' }, { quoted: message });
    }
    const action = String(args?.[0] || 'status').toLowerCase();
    const saved = await store.getSetting(chatId, WELCOME_PACK_SETTING);
    const config = normalizeWelcomePackConfig(saved);

    if (action === 'help') {
      return sock.sendMessage(chatId, { text: usage() }, { quoted: message });
    }

    if (action === 'status') {
      const previews = config.messages.map((text, index) =>
        `*Message ${index + 1}*\n${String(text).slice(0, 450)}`
      );
      return sock.sendMessage(chatId, {
        text: `*WELCOME PACK STATUS*\n\nStatus: ${config.enabled ? '🟢 ON' : '🔴 OFF'}\n\n${previews.join('\n\n')}\n\nUse .welcomeforge help for controls.`
      }, { quoted: message });
    }

    if (action === 'on' || action === 'off') {
      const next = { ...config, enabled: action === 'on' };
      if (!await store.saveSettingVerified(chatId, WELCOME_PACK_SETTING, next)) {
        return sock.sendMessage(chatId, { text: '❌ Could not verify the welcome-pack setting. No success was recorded.' }, { quoted: message });
      }
      return sock.sendMessage(chatId, {
        text: action === 'on'
          ? '✅ The two-message welcome pack is ON for this group.'
          : '⏸️ The two-message welcome pack is OFF for this group. Other group features, member tracking and lifecycle handling remain unchanged.'
      }, { quoted: message });
    }

    if (action === 'edit') {
      const slot = Number(args?.[1]);
      const rawText = String(context.messageText || context.rawText || '');
      const editCommand = rawText.match(/^\\s*\\S+\\s+edit\\s+[12]\\s*/i);
      const text = (editCommand ? rawText.slice(editCommand[0].length) : args.slice(2).join(' ')).trim();
      if (![1, 2].includes(slot) || !text) {
        return sock.sendMessage(chatId, { text: 'Usage: .welcomeforge edit 1|2 <new message>\nUse {user} to tag members and {daily_activity} in message 2.' }, { quoted: message });
      }
      if (text.length > 3500) {
        return sock.sendMessage(chatId, { text: '❌ Keep each welcome message under 3,500 characters.' }, { quoted: message });
      }
      const next = { ...config, messages: [...config.messages] };
      next.messages[slot - 1] = text;
      if (!await store.saveSettingVerified(chatId, WELCOME_PACK_SETTING, next)) {
        return sock.sendMessage(chatId, { text: '❌ Could not verify the message update. The saved pack was not confirmed.' }, { quoted: message });
      }
      return sock.sendMessage(chatId, { text: `✅ Welcome pack message ${slot} updated for this group. The other message was preserved.` }, { quoted: message });
    }

    if (action === 'reset') {
      const slot = Number(args?.[1]);
      if (![1, 2].includes(slot)) {
        return sock.sendMessage(chatId, { text: 'Usage: .welcomeforge reset 1|2' }, { quoted: message });
      }
      const next = { ...config, messages: [...config.messages] };
      next.messages[slot - 1] = DEFAULT_WELCOME_PACK_MESSAGES[slot - 1];
      if (!await store.saveSettingVerified(chatId, WELCOME_PACK_SETTING, next)) {
        return sock.sendMessage(chatId, { text: '❌ Could not verify the reset. The saved message was not confirmed.' }, { quoted: message });
      }
      return sock.sendMessage(chatId, { text: `↩️ Welcome pack message ${slot} restored to its default. The other message and pack switch were preserved.` }, { quoted: message });
    }

    return sock.sendMessage(chatId, { text: usage() }, { quoted: message });
  }
};
