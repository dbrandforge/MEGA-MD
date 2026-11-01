import store from '../lib/lightweight_store.js';
import isAdmin from '../lib/isAdmin.js';

const KEY = 'devilsBasketSessions';

export default {
  command: 'endbasket',
  aliases: ['stopbasket'],
  category: 'games',
  description: 'End your Devil’s Basket run after attempting a dare; admins can clear all runs.',
  usage: '.endbasket',
  groupOnly: true,
  async handler(sock, message, args, context) {
    const { chatId, senderId, channelInfo } = context;
    const sessions = (await store.getSetting(chatId, KEY)) || {};
    let admin = !!(context.isSenderAdmin || context.senderIsOwnerOrSudo || context.isOwnerOrSudoCheck || message.key.fromMe);
    if (!admin) {
      try { admin = !!(await isAdmin(sock, chatId, senderId)).isSenderAdmin; } catch {}
    }

    if (admin) {
      const count = Object.keys(sessions).length;
      await store.saveSetting(chatId, KEY, {});
      return sock.sendMessage(chatId, { text: `🛑 Admin ended ${count} active Devil’s Basket run(s).`, ...channelInfo }, { quoted: message });
    }

    const session = sessions[senderId];
    if (!session) return sock.sendMessage(chatId, { text: 'You do not have an active Devil’s Basket run.', ...channelInfo }, { quoted: message });
    if (!(session.attempts > 0)) {
      return sock.sendMessage(chatId, { text: 'Attempt at least one Basket dare before ending your run.', ...channelInfo }, { quoted: message });
    }
    delete sessions[senderId];
    await store.saveSetting(chatId, KEY, sessions);
    return sock.sendMessage(chatId, { text: '🛑 Your Devil’s Basket run has ended.', ...channelInfo }, { quoted: message });
  }
};
