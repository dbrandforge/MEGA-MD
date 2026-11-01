import { getManualLockableGames, getManualGameLocks, setManualGameLock } from './daylock.js';

export default {
  command: 'gamelock',
  aliases: ['lockgame'],
  category: 'admin',
  description: 'Lock or unlock games that are normally available every day.',
  usage: '.gamelock list | .gamelock <game> on|off',
  groupOnly: true,
  adminOnly: true,
  async handler(sock, message, args, context) {
    const { chatId, channelInfo } = context;
    const games = getManualLockableGames();
    const action = (args[0] || '').toLowerCase();

    if (!action || action === 'list' || action === 'status') {
      const locks = await getManualGameLocks(chatId);
      const lines = Object.entries(games).map(([key, name]) =>
        `${locks[key]?.locked ? '🔒 LOCKED' : '🟢 OPEN'} — ${name} (\`.gamelock ${key} ${locks[key]?.locked ? 'off' : 'on'}\`)`
      );
      return sock.sendMessage(chatId, {
        text: `🎮 *MANUAL GAME ACCESS*\\n\\n${lines.join('\\n')}\\n\\nScheduled games keep their existing day restrictions. These controls apply only to games that are otherwise open every day.`,
        ...channelInfo
      }, { quoted: message });
    }

    const game = action;
    const state = (args[1] || '').toLowerCase();
    if (!Object.hasOwn(games, game) || !['on', 'off', 'lock', 'unlock'].includes(state)) {
      return sock.sendMessage(chatId, {
        text: `Usage: *.gamelock list* or *.gamelock <game> on|off*\\n\\nGames: ${Object.keys(games).join(' | ')}\\n\\nUse *on* to lock and *off* to unlock.`,
        ...channelInfo
      }, { quoted: message });
    }

    const locked = state === 'on' || state === 'lock';
    await setManualGameLock(chatId, game, locked);
    return sock.sendMessage(chatId, {
      text: locked
        ? `🔒 *${games[game]} locked.* Members cannot start or continue it until an admin unlocks it.`
        : `🟢 *${games[game]} unlocked.* It is available every day again.`,
      ...channelInfo
    }, { quoted: message });
  }
};
