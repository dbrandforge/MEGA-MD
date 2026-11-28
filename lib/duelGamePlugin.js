import { randomBytes } from 'node:crypto';
import store from './lightweight_store.js';
import { isGameAllowed } from '../plugins/daylock.js';

const tag = id => '@' + String(id || '').split('@')[0];
const mentionsIn = message => message?.message?.extendedTextMessage?.contextInfo?.mentionedJid
  || message?.message?.imageMessage?.contextInfo?.mentionedJid || [];
const matchId = () => randomBytes(2).toString('hex').toUpperCase();

export function createDuelPlugin({ command, key, engine, description, rules = '', aliases = [] }) {
  const { initial, move, status, render, sideName } = engine;
  return {
    command,
    aliases,
    category: 'games',
    groupOnly: true,
    cooldown: 1200,
    description,
    usage: `.${command} @player | .${command} accept [id] | .${command} move <from> <to> | .${command} board | .${command} resign`,
    async handler(sock, message, args, context) {
      const chatId = context.chatId || message.key.remoteJid;
      const senderId = context.senderId || message.key.participant || message.key.remoteJid;
      const channelInfo = context.channelInfo || {};
      const send = (text, extra = {}) => sock.sendMessage(chatId, { text, ...extra, ...channelInfo }, { quoted: message });
      if (!String(chatId).endsWith('@g.us')) return send('This game is played in a group. Challenge someone in a group chat.');
      const access = await isGameAllowed(chatId, command);
      const action = String(args[0] || 'help').toLowerCase();
      const sessions = (await store.getSetting(chatId, key)) || { challenges: {}, matches: {} };
      sessions.challenges ||= {}; sessions.matches ||= {};
      const save = async () => {
        if (!await store.saveSettingVerified(chatId, key, sessions)) throw new Error(`${command} session could not be saved.`);
      };
      const now = Date.now();
      let cleaned = false;
      for (const [id, challenge] of Object.entries(sessions.challenges)) {
        if (!challenge || challenge.expiresAt <= now) { delete sessions.challenges[id]; cleaned = true; }
      }
      for (const match of Object.values(sessions.matches)) {
        if (match.status === 'active' && match.lastMoveAt && now - match.lastMoveAt > 24 * 60 * 60 * 1000) {
          match.status = 'finished'; match.result = 'inactive-timeout'; match.endedAt = now; match.winner = null; cleaned = true;
        }
      }
      const finished = Object.values(sessions.matches).filter(match => match.status !== 'active').sort((a,b) => (b.endedAt || 0) - (a.endedAt || 0));
      for (const match of finished.slice(30)) { delete sessions.matches[match.id]; cleaned = true; }
      if (cleaned) await save();
      const activeMatch = Object.values(sessions.matches).find(m => m.status === 'active' && m.players && Object.values(m.players).includes(senderId));
      const playerSide = match => match.players.w === senderId ? 'w' : match.players.b === senderId ? 'b' : null;

      if (['help', ''].includes(action)) return send(
        `♟️ *${command.toUpperCase()} — TWO-PLAYER MATCH*\n\n` +
        `• *.${command} @player* — challenge a player\n• *.${command} accept [id]* — accept a challenge\n` +
        `• *.${command} move <from> <to>* — make a move\n• *.${command} board* — show your board\n• *.${command} status* — match status\n• *.${command} resign* — resign\n\n` +
        'Each match is isolated. Different pairs can play at the same time; only the two invited players can move in their match.' + (rules ? `\\n\\n${rules}` : '')
      );

      if (['accept', 'yes'].includes(action)) {
        if (!access.ok) return send(access.msg);
        if (activeMatch) return send('You are already in an active match. Finish or resign before joining another.');
        const challenge = Object.values(sessions.challenges)
          .filter(c => c.to === senderId && c.expiresAt > Date.now())
          .sort((a,b) => b.createdAt-a.createdAt)[0];
        const chosen = args[1] ? sessions.challenges[String(args[1]).toUpperCase()] : challenge;
        if (!chosen || chosen.to !== senderId || chosen.expiresAt <= Date.now()) return send('No pending challenge addressed to you. Ask for a fresh challenge.');
        if (Object.values(sessions.matches).some(m => m.status === 'active' && Object.values(m.players || {}).includes(chosen.from))) return send('The challenger is already playing another match.');
        delete sessions.challenges[chosen.id];
        const id = matchId();
        const game = { id, status: 'active', players: { w: chosen.from, b: senderId }, state: initial(), startedAt: Date.now(), lastMoveAt: Date.now() };
        sessions.matches[id] = game;
        await save();
        return send(`⚔️ *${command.toUpperCase()} MATCH ${id} STARTED*\nWhite: ${tag(game.players.w)}\nBlack: ${tag(game.players.b)}\n\n${render(game.state)}\n\n${sideName(game.state.turn)} moves first. Use *.${command} move <from> <to>*.`, { mentions: [game.players.w, game.players.b] });
      }

      if (['challenge', 'invite'].includes(action) || (mentionsIn(message).length && !['move'].includes(action))) {
        if (!access.ok) return send(access.msg);
        if (activeMatch) return send('You are already in an active match. Finish or resign first.');
        const target = mentionsIn(message)[0];
        if (!target || target === senderId) return send(`Mention one opponent: *.${command} @player*.`);
        if (Object.values(sessions.matches).some(m => m.status === 'active' && Object.values(m.players || {}).includes(target))) return send('That player is already in an active match.');
        const id = matchId();
        sessions.challenges[id] = { id, from: senderId, to: target, createdAt: Date.now(), expiresAt: Date.now() + 5 * 60 * 1000 };
        await save();
        return send(`🎯 ${tag(target)}, ${tag(senderId)} challenged you to ${command.toUpperCase()}.\nAccept with *.${command} accept ${id}* within 5 minutes.\nChallenge ID: *${id}*.`, { mentions: [senderId, target] });
      }

      if (['board', 'status'].includes(action)) {
        const match = args[1] ? sessions.matches[String(args[1]).toUpperCase()] : activeMatch;
        if (!match || match.status !== 'active' || !playerSide(match)) return send('You are not a participant in an active match. Start with a challenge.');
        return send(`♟️ *${command.toUpperCase()} · MATCH ${match.id}*\nWhite: ${tag(match.players.w)}\nBlack: ${tag(match.players.b)}\nTurn: ${sideName(match.state.turn)}\n\n${render(match.state)}`, { mentions: [match.players.w, match.players.b] });
      }

      if (['resign', 'surrender', 'quit'].includes(action)) {
        if (!activeMatch) return send('You are not in an active match.');
        activeMatch.status = 'finished'; activeMatch.result = 'resignation'; activeMatch.winner = activeMatch.players[ playerSide(activeMatch) === 'w' ? 'b' : 'w' ]; activeMatch.endedAt = Date.now();
        await save();
        return send(`🏳️ ${tag(senderId)} resigned. ${tag(activeMatch.winner)} wins match ${activeMatch.id}.`, { mentions: [senderId, activeMatch.winner] });
      }

      if (action === 'move') {
        if (!activeMatch) return send('You are not in an active match.');
        const side = playerSide(activeMatch);
        if (activeMatch.state.turn !== side) return send('It is not your turn.');
        const result = move(activeMatch.state, args[1], args[2], args[3]);
        if (!result.ok) return send(`❌ ${result.error}`);
        activeMatch.state = result.state;
        activeMatch.lastMoveAt = Date.now();
        const outcome = status(activeMatch.state);
        if (outcome.over) {
          activeMatch.status = 'finished'; activeMatch.endedAt = Date.now();
          activeMatch.winner = outcome.winner ? activeMatch.players[outcome.winner] : null;
          activeMatch.result = outcome.checkmate ? 'checkmate' : outcome.draw ? 'draw' : 'completed';
        }
        await save();
        const last = outcome.over
          ? (outcome.winner ? `🏆 ${tag(activeMatch.winner)} wins match ${activeMatch.id}.` : `🤝 Match ${activeMatch.id} is a draw.`)
          : `${outcome.check ? '⚠️ CHECK! ' : ''}${sideName(activeMatch.state.turn)} to move.`;
        return send(`♟️ *${command.toUpperCase()} · MATCH ${activeMatch.id}*\n${render(activeMatch.state)}\n\n${last}`, { mentions: [activeMatch.players.w, activeMatch.players.b, ...(activeMatch.winner ? [activeMatch.winner] : [])] });
      }

      return send(`Unknown action. Use *.${command} help*.`);
    }
  };
}
