import store from '../lib/lightweight_store.js';
import isAdmin from '../lib/isAdmin.js';

const KEY = 'todSessions';

export default {
  command: 'endtod',
  aliases: ['stoptod'],
  category: 'games',
  description: 'End your active Truth or Dare session after participating; admins can end sessions independently.',
  usage: '.endtod',
  groupOnly: true,
  async handler(sock, message, args, context) {
    const { chatId, senderId, channelInfo } = context;
    const sessions = (await store.getSetting(chatId, KEY)) || {};
    const active = Object.values(sessions).filter(s => s.status === 'active');
    if (!active.length) return sock.sendMessage(chatId, { text: 'There is no active Truth or Dare session.', ...channelInfo }, { quoted: message });

    let admin = !!(context.isSenderAdmin || context.senderIsOwnerOrSudo || context.isOwnerOrSudoCheck || message.key.fromMe);
    if (!admin) {
      try { admin = !!(await isAdmin(sock, chatId, senderId)).isSenderAdmin; } catch {}
    }

    if (admin) {
      for (const session of active) session.status = 'ended';
      await store.saveSetting(chatId, KEY, sessions);
      return sock.sendMessage(chatId, { text: `🛑 Admin ended ${active.length} active Truth or Dare session(s).`, mentions: active.flatMap(s => s.players || []), ...channelInfo }, { quoted: message });
    }

    const session = active.find(s => s.players?.includes(senderId));
    if (!session) return sock.sendMessage(chatId, { text: 'You are not part of an active Truth or Dare session.', ...channelInfo }, { quoted: message });
    if (!(session.questionsCompleted?.[senderId] > 0)) {
      return sock.sendMessage(chatId, { text: 'Complete at least one Truth or Dare prompt with *.done* before ending your session.', ...channelInfo }, { quoted: message });
    }
    session.status = 'ended';
    session.endedAt = Date.now();
    session.endedBy = senderId;
    await store.saveSetting(chatId, KEY, sessions);
    return sock.sendMessage(chatId, { text: '🛑 Your Truth or Dare session has ended.', mentions: session.players, ...channelInfo }, { quoted: message });
  }
};
