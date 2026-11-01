import store from '../lib/lightweight_store.js';
import isAdmin from '../lib/isAdmin.js';
import { isFeatureGroup } from '../lib/featureGroups.js';

const HOTSEAT_KEY = 'hotseatSession';

function mention(jid) { return `@${(jid || '').split('@')[0]}`; }

export default {
  command: 'endhotseat',
  aliases: ['stophotseat', 'endhs'],
  category: 'games',
  description: 'End Hot Seat after participating; admins can end it independently.',
  usage: '.endhotseat',
  groupOnly: true,
  async handler(sock, message, args, context) {
    const { chatId, senderId, channelInfo } = context;
    if (!isFeatureGroup(chatId)) return sock.sendMessage(chatId, { text: 'Hot Seat is enabled only in the authorized feature groups.', ...channelInfo }, { quoted: message });
    const session = await store.getSetting(chatId, HOTSEAT_KEY);
    if (!session || !['pending', 'active'].includes(session.status)) {
      return sock.sendMessage(chatId, { text: 'No active Hot Seat session.', ...channelInfo }, { quoted: message });
    }

    let admin = !!(context.isSenderAdmin || context.senderIsOwnerOrSudo || context.isOwnerOrSudoCheck || message.key.fromMe);
    if (!admin) { try { admin = !!(await isAdmin(sock, chatId, senderId)).isSenderAdmin; } catch {} }

    if (!admin) {
      const state = session.playerStates?.[senderId];
      if (!session.players?.includes(senderId) || session.status !== 'active' || !state || state.status !== 'active') {
        return sock.sendMessage(chatId, { text: 'Only a current Hot Seat player or an admin can end this session.', ...channelInfo }, { quoted: message });
      }
      if (!(state.questionsAnswered > 0) || state.waiting) {
        return sock.sendMessage(chatId, { text: 'Answer your current Hot Seat question first. You can end the session after your answer has been recorded.', ...channelInfo }, { quoted: message });
      }
    }

    await store.saveSetting(chatId, HOTSEAT_KEY, null);
    return sock.sendMessage(chatId, {
      text: admin ? '🛑 *Hot Seat ended by an admin.*' : `🛑 *Hot Seat ended by ${mention(senderId)} after completing a question.*`,
      mentions: session.players || [],
      ...channelInfo
    }, { quoted: message });
  }
};
