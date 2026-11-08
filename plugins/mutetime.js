import store from '../lib/lightweight_store.js';
import { getSoftMuteDurationHours } from './softmute.js';

const KEY = 'softMuteDurationHours';
const mention = jid => '@' + String(jid || '').split('@')[0].split(':')[0];

export default {
  command: 'mutetime',
  aliases: ['muteduration', 'softmutetime'],
  category: 'admin',
  description: 'Set the group default soft-mute duration.',
  usage: '.mutetime <1-168 hours|status|reset>',
  groupOnly: true,
  adminOnly: true,
  async handler(sock, message, args, context) {
    const { chatId, channelInfo } = context;
    const action = String(args?.[0] || 'status').toLowerCase();
    if (action === 'status') {
      const hours = await getSoftMuteDurationHours(chatId);
      return sock.sendMessage(chatId, { text: `⏱️ *SOFT-MUTE DURATION*\\n\\nCurrent group duration: *${hours} hour(s)*\\n\\nChange it with *.mutetime 4h* or restore the default with *.mutetime reset*.`, ...channelInfo }, { quoted: message });
    }
    if (action === 'reset' || action === 'default') {
      if (!await store.saveSettingVerified(chatId, KEY, null)) {
        return sock.sendMessage(chatId, { text: '❌ Could not restore the default duration.', ...channelInfo }, { quoted: message });
      }
      const hours = await getSoftMuteDurationHours(chatId);
      return sock.sendMessage(chatId, { text: `✅ Soft-mute duration restored to the default: *${hours} hour(s)*.`, ...channelInfo }, { quoted: message });
    }
    const match = action.match(/^(\\d{1,3})(?:h|hr|hrs|hour|hours)?$/);
    const hours = match ? Number(match[1]) : NaN;
    if (!Number.isInteger(hours) || hours < 1 || hours > 168) {
      return sock.sendMessage(chatId, { text: 'Use *.mutetime 4h* to set four hours, *.mutetime status* to check, or *.mutetime reset* to restore the default. Allowed range: 1–168 hours.', ...channelInfo }, { quoted: message });
    }
    if (!await store.saveSettingVerified(chatId, KEY, hours)) {
      return sock.sendMessage(chatId, { text: '❌ Could not save the group soft-mute duration. No setting was changed.', ...channelInfo }, { quoted: message });
    }
    return sock.sendMessage(chatId, { text: `✅ Group soft-mute duration updated to *${hours} hour(s)*. New soft-mutes will use this duration; existing mutes keep their original expiry.`, ...channelInfo }, { quoted: message });
  }
};
