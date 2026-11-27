import { recoverHotSeatPlayer, replaceHotSeatPlayer } from './hotseat.js';
import { recoverPickYourSinPlayer, replacePickYourSinPlayer } from './pick-your-sin.js';
import { recoverTodPlayer, replaceTodPlayer } from './tod.js';
import { recoverWyrPlayer, replaceWyrPlayer } from './wyr.js';
import { canonicalWhatsAppUserId } from '../lib/whatsappIdentity.js';

function getMentions(message) {
  const context = message?.message?.extendedTextMessage?.contextInfo
    || message?.message?.imageMessage?.contextInfo
    || message?.message?.videoMessage?.contextInfo
    || {};
  return context.mentionedJid || [];
}

export default {
  command: 'gamerescue',
  aliases: ['grescue'],
  category: 'admin',
  description: 'Resume an auto-removed player or replace them within the 15-minute recovery window.',
  usage: '.gamerescue resume @player | .gamerescue replace @removed @replacement',
  groupOnly: true,
  adminOnly: true,
  async handler(sock, message, args, context) {
    const chatId = context.chatId || message.key.remoteJid;
    const action = String(args?.[0] || '').toLowerCase();
    const tagged = await Promise.all(getMentions(message).map(async id => (await canonicalWhatsAppUserId(sock, id)) || id));
    const mentions = [...new Set(tagged)];
    const reply = text => sock.sendMessage(chatId, { text }, { quoted: message });

    if (action === 'resume') {
      if (mentions.length !== 1 || tagged.length !== 1) {
        return reply('Tag exactly one removed player: *.gamerescue resume @player*.');
      }
      const player = mentions[0];
      if (await recoverHotSeatPlayer(sock, chatId, player)) {
        return reply('▶️ The original Hot Seat player has been restored with their saved question and progress.');
      }
      if (await recoverPickYourSinPlayer(sock, chatId, player)) {
        return reply('▶️ The original PICK YOUR SIN player has been restored with their saved prompt, colour and progress.');
      }
      if (await recoverTodPlayer(sock, chatId, player)) {
        return reply('▶️ The original Truth or Dare player has been restored to the same round and prompt.');
      }
      if (await recoverWyrPlayer(sock, chatId, player)) {
        return reply('▶️ The original WYR session has been restored with its previous dilemma and answers.');
      }
      return reply('No recoverable Hot Seat, PICK YOUR SIN, Truth or Dare, or WYR session was found for that player. The 15-minute recovery window may have expired.');
    }

    if (action === 'replace') {
      if (mentions.length !== 2 || tagged.length !== 2) {
        return reply('Tag the removed player first and the substitute second: *.gamerescue replace @removed @replacement*.');
      }
      const [removed, replacement] = mentions;
      if (await replaceHotSeatPlayer(sock, chatId, removed, replacement)) {
        return reply('🔁 The substitute has joined Hot Seat with a fresh 15-question session. The removed player’s progress was not transferred.');
      }
      if (await replacePickYourSinPlayer(sock, chatId, removed, replacement)) {
        return reply('🔁 The substitute has joined PICK YOUR SIN from the beginning with fresh progress, colour selection and pass.');
      }
      if (await replaceTodPlayer(sock, chatId, removed, replacement)) {
        return reply('🔁 The substitute has taken the Truth or Dare slot with fresh personal progress and a new prompt.');
      }
      if (await replaceWyrPlayer(sock, chatId, removed, replacement)) {
        return reply('🔁 The substitute has started a fresh WYR session with a new 20-question count.');
      }
      return reply('No matching recoverable removal was found. Check the tagged order, registered gender where required, and the 15-minute deadline.');
    }

    return reply('Use *.gamerescue resume @player* to restore the original player, or *.gamerescue replace @removed @replacement* to add a substitute.');
  }
};
