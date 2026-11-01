import { completeTodTurn } from './tod.js';

export default {
  command: 'done',
  aliases: ['next', 'toddone'],
  category: 'games',
  description: 'Complete your current Truth or Dare prompt and continue, or finish your session.',
  usage: '.done | .done end',
  groupOnly: true,
  async handler(sock, message, args, context) {
    const { chatId, senderId, channelInfo } = context;
    const endAfter = (args[0] || '').toLowerCase() === 'end';
    const handled = await completeTodTurn(sock, chatId, senderId, { endAfter, message });
    if (!handled) {
      return sock.sendMessage(chatId, {
        text: 'You are not currently expected to complete a Truth or Dare prompt.',
        ...channelInfo
      }, { quoted: message });
    }
  }
};
