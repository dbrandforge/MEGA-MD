import { isFeatureGroup } from '../lib/featureGroups.js';
import { handleHangmanGuess } from './hangman.js';

export default {
  command: 'guess',
  aliases: ['g'],
  category: 'games',
  description: 'Submit a Hangman letter or whole-word guess.',
  usage: '.guess <letter|word>',
  groupOnly: true,
  async handler(sock, message, args, context) {
    const { chatId, channelInfo } = context;
    if (!isFeatureGroup(chatId)) {
      return sock.sendMessage(chatId, { text: 'This game is available in the designated feature groups.', ...channelInfo }, { quoted: message });
    }
    if (!args.length) {
      return sock.sendMessage(chatId, { text: 'Use *.guess <letter>* or *.guess <whole-word>*.', ...channelInfo }, { quoted: message });
    }
    const senderId = context.senderId || message.key.participant || message.key.remoteJid;
    return handleHangmanGuess(sock, chatId, message, senderId, args.join(' '), channelInfo);
  }
};
