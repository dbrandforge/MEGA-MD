import store from './lightweight_store.js';
import { resumeMathGame } from '../plugins/math.js';
import { resumeTriviaGame } from '../plugins/trivia.js';
import { resumeHangmanGame } from '../plugins/hangman.js';
import { resumeHotSeatSession } from '../plugins/hotseat.js';
import { resumePickYourSinSessions } from '../plugins/pick-your-sin.js';

const recoveredSockets = new WeakSet();

const RECOVERABLE_GAMES = [
  { key: 'mathGame', label: 'Maths Arena', active: value => value?.active === true,
    resume: (sock, chatId) => resumeMathGame(sock, chatId, null, {}) },
  { key: 'triviaArenaV2', label: 'Trivia Arena', active: value => value?.active === true,
    resume: (sock, chatId) => resumeTriviaGame(sock, chatId, null, {}) },
  { key: 'hangmanGame', label: 'Hangman', active: value => value?.status === 'active',
    resume: (sock, chatId) => resumeHangmanGame(sock, chatId, null, {}) },
  { key: 'hotseatSession', label: 'Hot Seat', active: value => ['active', 'pending'].includes(value?.status),
    resume: (sock, chatId) => resumeHotSeatSession(sock, chatId) },
  { key: 'pickYourSinSessions', label: 'PICK YOUR SIN',
    active: value => Object.values(value || {}).some(session => session?.status === 'active'),
    resume: (sock, chatId) => resumePickYourSinSessions(sock, chatId) }
];

/**
 * Restore only known active sessions after a successful WhatsApp connection.
 * Resume handlers issue fresh prompts and rebuild timers; they never replay
 * old inbound messages or execute overdue timeout actions.
 */
export async function resumePersistedGameSessions(sock, groupIds = [], logger = console) {
  if (!sock || typeof sock !== 'object') return { groups: 0, resumed: 0, failed: 0 };
  if (recoveredSockets.has(sock)) return { groups: 0, resumed: 0, failed: 0, skipped: true };
  recoveredSockets.add(sock);

  const groups = [...new Set((groupIds || []).filter(id => String(id).endsWith('@g.us')))];
  let resumed = 0;
  let failed = 0;
  for (const chatId of groups) {
    for (const game of RECOVERABLE_GAMES) {
      try {
        const saved = await store.getSettingForGameResume(chatId, game.key);
        if (!game.active(saved)) continue;
        const result = await game.resume(sock, chatId);
        if (result) resumed++;
      } catch (error) {
        failed++;
        logger?.('error', `[game-recovery] ${game.label} resume failed in ${chatId}: ${error.message}`);
      }
    }
  }
  logger?.('info', `[game-recovery] Checked ${groups.length} feature group(s); resumed ${resumed} active game session(s); failures: ${failed}.`);
  return { groups: groups.length, resumed, failed };
}
