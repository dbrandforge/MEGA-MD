import store from '../lib/lightweight_store.js';
import isAdmin from '../lib/isAdmin.js';
import { isFeatureGroup } from '../lib/featureGroups.js';

const KEY = 'hotseatSession';

export default {
  command: 'endhotseat',
  aliases: ['stophotseat'],
  category: 'games',
  description: 'End the active Hot Seat session after participating, or let an admin end it at any time.',
  usage: '.endhotseat',
  groupOnly: true,
  async handler(sock, message, args, context) {
    const { chatId, senderId, channelInfo } = context;
    if (!isFeatureGroup(chatId)) return sock.sendMessage(chatId, { text: 'Hot Seat is enabled only in the authorized feature groups.', ...channelInfo }, { quoted: message });
    const session = await store.getSetting(chatId, KEY);
    if (!session || !['pending', 'active'].includes(session.status)) {
      return sock.sendMessage(chatId, { text: 'There is no active Hot Seat session.', ...channelInfo }, { quoted: message });
    }

    let admin = !!(context.isSenderAdmin || context.senderIsOwnerOrSudo || context.isOwnerOrSudoCheck || message.key.fromMe);
    if (!admin) {
      try { admin = !!(await isAdmin(sock, chatId, senderId)).isSenderAdmin; } catch {}
    }

    if (!admin) {
      const state = session.playerStates?.[senderId];
      if (!session.players?.includes(senderId) || session.status !== 'active' || !state || state.status !== 'active') {
        return sock.sendMessage(chatId, { text: 'Only an active Hot Seat player or an admin can end this session.', ...channelInfo }, { quoted: message });
      }
      if (!state.questionsAnswered || state.waiting) {
        return sock.sendMessage(chatId, { text: 'Answer your current Hot Seat question first. You can end the session after your answer has been recorded.', ...channelInfo }, { quoted: message });
      }
    }

    await store.saveSetting(chatId, KEY, null);
    return sock.sendMessage(chatId, {
      text: admin ? '🛑 *Hot Seat ended by an admin.*' : `🛑 *Hot Seat ended by ${message.pushName || 'a participating player'} after completing a question.*`,
      mentions: session.players || [],
      ...channelInfo
    }, { quoted: message });
  }
};
