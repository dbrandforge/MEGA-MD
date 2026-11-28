import { isFeatureGroup } from '../lib/featureGroups.js';
import { resumeTriviaGame } from './trivia.js';
import { resumeMathGame } from './math.js';
import { resumeHangmanGame } from './hangman.js';

export default {
  command: 'game',
  aliases: ['gameresume'],
  category: 'games',
  description: 'Resume a stalled active game in this group.',
  usage: '.game resume <trivia|math|hangman>',
  groupOnly: true,
  async handler(sock, message, args, context) {
    const chatId = context.chatId || message.key.remoteJid;
    const channelInfo = context.channelInfo || {};
    if (!isFeatureGroup(chatId)) {
      return sock.sendMessage(chatId, { text: 'Game recovery is available in the designated Forge Guard game groups.', ...channelInfo }, { quoted: message });
    }
    const action = String(args[0] || '').toLowerCase();
    const game = String(args[1] || '').toLowerCase();
    if (action !== 'resume' || !['trivia', 'math', 'maths', 'hangman'].includes(game)) {
      return sock.sendMessage(chatId, {
        text: 'Use *.game resume trivia*, *.game resume math*, or *.game resume hangman*.',
        ...channelInfo
      }, { quoted: message });
    }
    if (game === 'trivia') return resumeTriviaGame(sock, chatId, message, channelInfo);
    if (game === 'math' || game === 'maths') return resumeMathGame(sock, chatId, message, channelInfo);
    return resumeHangmanGame(sock, chatId, message, channelInfo);
  }
};
