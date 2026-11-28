import store from '../lib/lightweight_store.js';
import { createMiniSudoku, setMiniSudokuCell, renderMiniSudoku, checkMiniSudoku, clearMiniSudokuCell } from '../lib/miniSudoku.js';
import { isGameAllowed } from './daylock.js';

const KEY = 'sudokuSessions';
const readSessions = async chatId => (await store.getSetting(chatId, KEY)) || {};
const readSessionsForResume = async chatId => (await store.getSettingForGameResume(chatId, KEY)) || {};
const writeSessions = async (chatId, sessions) => {
  if (!await store.saveSettingVerified(chatId, KEY, sessions)) throw new Error('Sudoku session could not be saved.');
};
const playerTag = id => '@' + String(id || '').split('@')[0];

export default {
  command: 'sudoku',
  aliases: ['sdk'],
  category: 'games',
  description: 'Play compact 3×3, 4×4 or 6×6 Sudoku puzzles; each player has a private session.',
  usage: '.sudoku start [easy|medium|hard] | .sudoku set <row> <column> <number> | .sudoku board | .sudoku check | .sudoku clear <row> <column> | .sudoku quit',
  cooldown: 1500,
  async handler(sock, message, args, context) {
    const chatId = context.chatId || message.key.remoteJid;
    const senderId = context.senderId || message.key.participant || message.key.remoteJid;
    const action = String(args[0] || 'help').toLowerCase();
    const access = await isGameAllowed(chatId, 'sudoku');
    const sessions = action === 'resume' ? await readSessionsForResume(chatId) : await readSessions(chatId);
    let game = sessions[senderId];
    if (game?.status === 'active' && game.expiresAt && game.expiresAt <= Date.now()) {
      delete sessions[senderId];
      await writeSessions(chatId, sessions);
      game = null;
    }

    if (action === 'resume') {
      if (!game || game.status !== 'active') return sock.sendMessage(chatId, { text: 'No saved Sudoku board is available to resume for you.', ...(context.channelInfo || {}) }, { quoted: message });
      await writeSessions(chatId, sessions);
      game.lastMoveAt = Date.now();
      game.expiresAt = Date.now() + 12 * 60 * 60 * 1000;
      sessions[senderId] = game;
      await writeSessions(chatId, sessions);
      return sock.sendMessage(chatId, { text: `▶️ *SUDOKU RESUMED*\n\n${renderMiniSudoku(game)}\n\nYour saved ${game.difficulty} progress is unchanged.`, ...(context.channelInfo || {}) }, { quoted: message });
    }

    if (['help', ''].includes(action)) {
      return sock.sendMessage(chatId, { text:
        '🧩 *MINI SUDOKU*\n\n' +
        'Easy: 3×3 · Medium: 4×4 · Hard: 6×6 (2×3 regions)\n' +
        'Each player gets a separate board, even in the same group.\n\n' +
        '• *.sudoku start easy*\n• *.sudoku start medium*\n• *.sudoku start hard*\n' +
        '• *.sudoku set <row> <column> <number>*\n• *.sudoku board*\n• *.sudoku check*\n' +
        '• *.sudoku clear <row> <column>*\n• *.sudoku resume*\n• *.sudoku quit*\n\n' +
        'Rows and columns start at 1. Dots are empty cells. A completed valid board wins.',
        ...(context.channelInfo || {}) }, { quoted: message });
    }

    if (action === 'start' || action === 'new') {
      if (!access.ok) return sock.sendMessage(chatId, { text: access.msg, ...(context.channelInfo || {}) }, { quoted: message });
      const difficulty = String(args[1] || 'easy').toLowerCase();
      if (game?.status === 'active') {
        return sock.sendMessage(chatId, { text: 'You already have an active Sudoku. Use *.sudoku board* or *.sudoku quit* first.', ...(context.channelInfo || {}) }, { quoted: message });
      }
      try {
        game = { ...createMiniSudoku(difficulty), status: 'active', playerId: senderId, lastMoveAt: Date.now(), expiresAt: Date.now() + 12 * 60 * 60 * 1000 };
        sessions[senderId] = game;
        await writeSessions(chatId, sessions);
        return sock.sendMessage(chatId, { text:
          `🧩 *SUDOKU — ${difficulty.toUpperCase()}*\nPlayer: ${playerTag(senderId)}\nBoard: ${game.size}×${game.size}\n\n${renderMiniSudoku(game)}\n\nEnter: *.sudoku set row column number*\nExample: *.sudoku set 1 2 3*`,
          mentions: [senderId], ...(context.channelInfo || {}) }, { quoted: message });
      } catch (error) {
        return sock.sendMessage(chatId, { text: `Could not start Sudoku: ${error.message}`, ...(context.channelInfo || {}) }, { quoted: message });
      }
    }

    if (!game || game.status !== 'active') {
      return sock.sendMessage(chatId, { text: 'You do not have an active Sudoku. Start one with *.sudoku start easy*.', ...(context.channelInfo || {}) }, { quoted: message });
    }

    if (action === 'board' || action === 'status') {
      return sock.sendMessage(chatId, { text: `🧩 *YOUR ${game.difficulty.toUpperCase()} SUDOKU* · ${game.size}×${game.size}\nMoves: ${game.moves || 0}\n\n${renderMiniSudoku(game)}\n\nUse *.sudoku set row column number*.`, ...(context.channelInfo || {}) }, { quoted: message });
    }

    if (action === 'set' || action === 'put') {
      if (!access.ok) return sock.sendMessage(chatId, { text: access.msg, ...(context.channelInfo || {}) }, { quoted: message });
      const row = Number(args[1]), col = Number(args[2]), value = args[3];
      const result = setMiniSudokuCell(game, row, col, value);
      if (!result.ok) return sock.sendMessage(chatId, { text: `❌ ${result.error}`, ...(context.channelInfo || {}) }, { quoted: message });
      game.lastMoveAt = Date.now(); game.expiresAt = Date.now() + 12 * 60 * 60 * 1000;
      const resultCheck = checkMiniSudoku(game);
      if (resultCheck.solved) {
        game.status = 'completed'; game.completedAt = Date.now();
        sessions[senderId] = game; await writeSessions(chatId, sessions);
        return sock.sendMessage(chatId, { text: `🏆 *SUDOKU SOLVED!*\n${playerTag(senderId)} completed the ${game.size}×${game.size} ${game.difficulty} puzzle in ${game.moves} moves.\n\n${renderMiniSudoku(game)}`, mentions: [senderId], ...(context.channelInfo || {}) }, { quoted: message });
      }
      sessions[senderId] = game; await writeSessions(chatId, sessions);
      return sock.sendMessage(chatId, { text: `✅ Entry saved. ${resultCheck.empty} empty cell(s) remain.\n\n${renderMiniSudoku(game)}\n\nUse *.sudoku check* to validate your progress.`, ...(context.channelInfo || {}) }, { quoted: message });
    }

    if (action === 'clear' || action === 'erase') {
      if (!access.ok) return sock.sendMessage(chatId, { text: access.msg, ...(context.channelInfo || {}) }, { quoted: message });
      const ok = clearMiniSudokuCell(game, Number(args[1]), Number(args[2]));
      if (!ok) return sock.sendMessage(chatId, { text: 'That cell cannot be cleared. Check its row and column, and remember that starting clues are fixed.', ...(context.channelInfo || {}) }, { quoted: message });
      game.lastMoveAt = Date.now(); game.expiresAt = Date.now() + 12 * 60 * 60 * 1000;
      sessions[senderId] = game; await writeSessions(chatId, sessions);
      return sock.sendMessage(chatId, { text: `Cell cleared.\n\n${renderMiniSudoku(game)}`, ...(context.channelInfo || {}) }, { quoted: message });
    }

    if (action === 'check') {
      const result = checkMiniSudoku(game);
      if (result.solved) {
        game.status = 'completed'; game.completedAt = Date.now();
        sessions[senderId] = game; await writeSessions(chatId, sessions);
        return sock.sendMessage(chatId, { text: `🏆 Puzzle solved in ${game.moves} moves!\n\n${renderMiniSudoku(game)}`, ...(context.channelInfo || {}) }, { quoted: message });
      }
      const errors = result.wrong.length ? result.wrong.map(([r,c]) => `R${r}C${c}`).join(', ') : 'none';
      return sock.sendMessage(chatId, { text: `🔎 *SUDOKU CHECK*\nEmpty cells: ${result.empty}\nIncorrect entries: ${errors}\n${result.empty || result.wrong.length ? 'Keep going.' : 'Solved!'}`, ...(context.channelInfo || {}) }, { quoted: message });
    }

    if (action === 'quit' || action === 'stop') {
      delete sessions[senderId]; await writeSessions(chatId, sessions);
      return sock.sendMessage(chatId, { text: 'Your Sudoku session has ended. Other players’ boards are untouched.', ...(context.channelInfo || {}) }, { quoted: message });
    }

    return sock.sendMessage(chatId, { text: 'Unknown Sudoku action. Use *.sudoku help*.', ...(context.channelInfo || {}) }, { quoted: message });
  }
};
