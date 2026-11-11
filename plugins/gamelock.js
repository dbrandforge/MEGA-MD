import { getManualLockableGames, getManualGameLocks, setManualGameLock, getGlobalGameLock, setGlobalGameLock } from './daylock.js';
import { resumeHotSeatSession } from './hotseat.js';

export default {
  command: 'gamelock',
  aliases: ['lockgame'],
  category: 'admin',
  description: 'Admin controls for locking or unlocking any group game.',
  usage: '.gamelock on|off | .gamelock <game> on|off | .gamelock status',
  groupOnly: true,
  adminOnly: true,
  async handler(sock, message, args, context) {
    const { chatId, channelInfo } = context;
    const games = getManualLockableGames();
    const action = (args[0] || '').toLowerCase();

    if (!action || action === 'list' || action === 'status') {
      const locks = await getManualGameLocks(chatId);
      const globalLocked = await getGlobalGameLock(chatId);
      const lines = Object.entries(games).map(([key, name]) =>
        `${locks[key]?.locked ? '🔒 INDIVIDUALLY LOCKED' : '🟢 INDIVIDUAL OPEN'} — ${name} (.gamelock ${key} ${locks[key]?.locked ? 'off' : 'on'})`
      );
      return sock.sendMessage(chatId, {
        text: `🎮 *GAME ACCESS STATUS*\n\nGlobal lock: ${globalLocked ? '🔒 ON — ALL GAMES LOCKED' : '🟢 OFF'}\nGlobal control: *.gamelock ${globalLocked ? 'off' : 'on'}*\n\n${lines.join('\n')}\n\nScheduled games keep their normal day restrictions. Individual settings are preserved while the global lock is active.`,
        ...channelInfo
      }, { quoted: message });
    }

    if (action === 'on' || action === 'off') {
      const locked = action === 'on';
      try {
        await setGlobalGameLock(chatId, locked);
      } catch (error) {
        console.error('[GAMELOCK] Could not persist global game lock:', error.message);
        return sock.sendMessage(chatId, { text: '❌ The global game-lock change could not be saved. No success was reported.', ...channelInfo }, { quoted: message });
      }
      return sock.sendMessage(chatId, {
        text: locked
          ? '🔒 *GLOBAL GAME LOCK ENABLED.* Every game in this group is now locked. Individual game settings have been preserved.'
          : '🟢 *GLOBAL GAME LOCK DISABLED.* Games are available again according to their individual locks and normal scheduled-day restrictions.',
        ...channelInfo
      }, { quoted: message });
    }

    const game = action;
    const state = (args[1] || '').toLowerCase();
    if (!Object.hasOwn(games, game) || !['on', 'off', 'lock', 'unlock'].includes(state)) {
      return sock.sendMessage(chatId, {
        text: `Usage: *.gamelock on|off*, *.gamelock status*, or *.gamelock <game> on|off*\n\nGames: ${Object.keys(games).join(' | ')}\n\nUse *on* to lock and *off* to unlock.`,
        ...channelInfo
      }, { quoted: message });
    }

    const locked = state === 'on' || state === 'lock';
    try {
      await setManualGameLock(chatId, game, locked);
    } catch (error) {
      console.error('[GAMELOCK] Could not persist manual game lock:', error.message);
      return sock.sendMessage(chatId, {
        text: '❌ The game-lock change could not be saved. No success was reported; please try again.',
        ...channelInfo
      }, { quoted: message });
    }
    if (!locked && game === 'hotseat') {
      try {
        const resumed = await resumeHotSeatSession(sock, chatId);
        if (resumed) console.log(`[GAMELOCK] Resumed ${resumed} paused Hot Seat player(s) in ${chatId}`);
      } catch (error) {
        console.error('[GAMELOCK] Could not resume Hot Seat after unlock:', error.message);
      }
    }

    return sock.sendMessage(chatId, {
      text: locked
        ? `🔒 *${games[game]} locked.* Members cannot start or continue it until an admin unlocks it.`
        : `🟢 *${games[game]} unlocked.* Its normal availability rules now apply${['basket', 'wcw', 'hotseat', 'anonymous', 'tod'].includes(game) ? ' (scheduled day restrictions remain in force)' : ''}.`,
      ...channelInfo
    }, { quoted: message });
  }
};
