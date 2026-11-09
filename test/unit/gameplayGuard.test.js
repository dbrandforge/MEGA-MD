import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/lightweight_store.js', () => ({
    default: { getSetting: vi.fn(async () => null) }
}));

import store from '../../lib/lightweight_store.js';
import {
    hasActiveGameplayState,
    isGroupGameplayActive,
    isExplicitAIRequest
} from '../../lib/gameplayGuard.js';

describe('gameplay-aware AI protection', () => {
    beforeEach(() => vi.clearAllMocks());

    it('recognizes active Math, Trivia and Hangman matches', () => {
        const now = Date.now();
        expect(hasActiveGameplayState({
            math: { active: true, matchExpiresAt: now + 60_000 }
        }, now)).toBe(true);
        expect(hasActiveGameplayState({
            trivia: { active: true, matchExpiresAt: now + 60_000 }
        }, now)).toBe(true);
        expect(hasActiveGameplayState({
            hangman: { status: 'active', expiresAt: now + 60_000 }
        }, now)).toBe(true);
    });

    it('ignores expired or completed game states', () => {
        const now = Date.now();
        expect(hasActiveGameplayState({
            math: { active: true, matchExpiresAt: now - 1 },
            trivia: { active: false },
            hangman: { status: 'ended', expiresAt: now + 60_000 }
        }, now)).toBe(false);
    });

    it('recognizes active social-game sessions and active TicTacToe', () => {
        const now = Date.now();
        expect(hasActiveGameplayState({
            hotseat: { status: 'active', startedAt: now - 1000 },
            wyr: { player: { expiresAt: now + 60_000 } }
        }, now)).toBe(true);
        expect(hasActiveGameplayState({
            tod: { player: { status: 'active', lastActivity: now - 1000 } }
        }, now)).toBe(true);
        expect(hasActiveGameplayState({
            basket: { player: { questionMessageId: 'q1', updatedAt: now - 1000 } }
        }, now)).toBe(true);
        expect(hasActiveGameplayState({}, now)).toBe(false);
    });

    it('recognizes the legacy solo Truth/Dare session store', () => {
        const now = Date.now();
        expect(hasActiveGameplayState({
            soloTod: { '2348000000000@s.whatsapp.net': { type: 'truth', startedAt: now - 1000, lastActivity: now } }
        }, now)).toBe(true);
        expect(hasActiveGameplayState({
            soloTod: { '2348000000000@s.whatsapp.net': { type: 'truth', startedAt: now - 3 * 60 * 60 * 1000 } }
        }, now)).toBe(false);
    });

    it('checks persisted group game state only for group chats', async () => {
        vi.mocked(store.getSetting).mockImplementation(async (_chatId, key) =>
            key === 'mathGame' ? { active: true, matchExpiresAt: Date.now() + 60_000 } : null
        );
        expect(await isGroupGameplayActive('120363000000000001@g.us')).toBe(true);
        expect(store.getSetting).toHaveBeenCalled();
        vi.mocked(store.getSetting).mockClear();
        expect(await isGroupGameplayActive('2348000000000@s.whatsapp.net')).toBe(false);
        expect(store.getSetting).not.toHaveBeenCalled();
    });

    it('recognizes explicit AI commands, direct bot questions and quoted answer requests', () => {
        const sock = { user: { id: '2348000000000:4@s.whatsapp.net' } };
        expect(isExplicitAIRequest({ text: '.gpt who is Wizkid?', isAICommand: true })).toBe(true);
        expect(isExplicitAIRequest({
            text: 'Who is Wizkid?',
            message: { message: { extendedTextMessage: { contextInfo: { mentionedJid: ['2348000000000@s.whatsapp.net'] } } } },
            sock
        })).toBe(true);
        expect(isExplicitAIRequest({
            text: 'Answer this 👇',
            message: { message: { extendedTextMessage: { contextInfo: { participant: '2348000000000@s.whatsapp.net' } } } },
            sock
        })).toBe(true);
    });

    it('does not mistake ordinary short game answers for AI requests', () => {
        const sock = { user: { id: '2348000000000:4@s.whatsapp.net' } };
        const message = {
            message: { extendedTextMessage: { contextInfo: { participant: '2348000000000@s.whatsapp.net' } } }
        };
        expect(isExplicitAIRequest({ text: 'A', message, sock })).toBe(false);
        expect(isExplicitAIRequest({ text: '42', message, sock })).toBe(false);
    });
});
