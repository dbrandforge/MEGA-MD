import { beforeEach, describe, expect, it, vi } from 'vitest';

const { settings, axiosPost } = vi.hoisted(() => ({
    settings: new Map(),
    axiosPost: vi.fn()
}));

vi.mock('axios', () => ({ default: { post: axiosPost } }));
vi.mock('sharp', () => ({ default: vi.fn() }));
vi.mock('@whiskeysockets/baileys', () => ({ downloadContentFromMessage: vi.fn() }));
vi.mock('../../lib/lightweight_store.js', () => ({
    default: {
        async getSetting(chatId, key) {
            return settings.get(`${chatId}:${key}`) ?? null;
        },
        async saveSettingVerified(chatId, key, value) {
            settings.set(`${chatId}:${key}`, structuredClone(value));
            return true;
        }
    }
}));
vi.mock('../../lib/chatbotMediaSettings.js', () => ({
    getChatbotMediaModes: vi.fn(async () => ({ stickers: false, voiceNotes: false }))
}));
vi.mock('../../plugins/chatbot.js', () => ({
    handleChatbotResponse: vi.fn(),
    isChatbotEnabledForMessage: vi.fn()
}));
vi.mock('../../lib/chatbotAccess.js', () => ({
    isExplicitlyAddressedInGroup: vi.fn(),
    jidMatchesAnyBotIdentity: vi.fn()
}));
vi.mock('../../lib/print.js', () => ({ printLog: vi.fn() }));

import {
    createGeminiMediaPayload,
    postGeminiWithRetry,
    getSafeGeminiErrorDetail,
    releaseMediaSlot,
    reserveMediaSlot,
    shouldRetryGeminiRequest
} from '../../lib/chatbotMedia.js';

describe('chatbot media provider reliability', () => {
    beforeEach(() => {
        settings.clear();
        axiosPost.mockReset();
        vi.useRealTimers();
    });

    it('builds Gemini generateContent payloads using REST camelCase inlineData', () => {
        const payload = createGeminiMediaPayload({
            prompt: 'Transcribe exactly',
            mimeType: 'audio/ogg',
            data: 'base64-audio',
            maxOutputTokens: 1200
        });

        expect(payload.contents[0].parts[1]).toEqual({
            inlineData: { mimeType: 'audio/ogg', data: 'base64-audio' }
        });
        expect(payload.generationConfig.maxOutputTokens).toBe(1200);
    });

    it('retries transient Gemini service and network failures only', () => {
        expect(shouldRetryGeminiRequest({ response: { status: 503 } })).toBe(true);
        expect(shouldRetryGeminiRequest({ response: { status: 429 } })).toBe(true);
        expect(shouldRetryGeminiRequest({ code: 'ECONNABORTED' })).toBe(true);
        expect(shouldRetryGeminiRequest({ response: { status: 400 } })).toBe(false);
        expect(shouldRetryGeminiRequest({ response: { status: 401 } })).toBe(false);
    });

    it('retries a transient 503 once and returns the recovered Gemini response', async () => {
        vi.useFakeTimers();
        axiosPost
            .mockRejectedValueOnce({ response: { status: 503 } })
            .mockResolvedValueOnce({ data: { candidates: [{ content: { parts: [{ text: 'Recovered' }] } }] } });

        const pending = postGeminiWithRetry('https://example.test/generateContent', {}, {}, 'voice_transcription');
        await vi.advanceTimersByTimeAsync(700);

        await expect(pending).resolves.toMatchObject({ data: { candidates: [{ content: { parts: [{ text: 'Recovered' }] } }] } });
        expect(axiosPost).toHaveBeenCalledTimes(2);
        expect(axiosPost.mock.calls[0][2].timeout).toBe(45_000);
    });

    it('extracts bounded provider diagnostics without exposing credential-like values', () => {
        const result = getSafeGeminiErrorDetail({
            code: 'ERR_BAD_RESPONSE',
            response: {
                status: 503,
                data: { error: { message: 'Temporary failure\nsee https://example.test/x?key=secret authorization: Bearer secret' } }
            }
        });

        expect(result.status).toBe(503);
        expect(result.code).toBe('ERR_BAD_RESPONSE');
        expect(result.detail).not.toContain('https://');
        expect(result.detail).not.toContain('secret');
        expect(result.detail.length).toBeLessThanOrEqual(180);
    });

    it('releases the reserved daily allowance after a failed provider attempt', async () => {
        const chatId = 'media-refund-test@g.us';
        const senderId = 'sender-refund-test@s.whatsapp.net';

        await expect(reserveMediaSlot(chatId, senderId, 'voice')).resolves.toBe(true);
        let usage = settings.get('global:chatbotMediaUsage');
        expect(usage.global.voice).toBe(1);

        await expect(releaseMediaSlot(chatId, senderId, 'voice')).resolves.toBe(true);
        usage = settings.get('global:chatbotMediaUsage');
        expect(usage.global.voice).toBe(0);
        expect(usage.chats[chatId].voice).toBe(0);
        expect(usage.senders[`${chatId}:${senderId}`].voice).toBe(0);
    });
});
