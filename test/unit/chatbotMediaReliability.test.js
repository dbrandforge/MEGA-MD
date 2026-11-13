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
    createGroqVisionPayload,
    createGroqAudioForm,
    postGroqAudioWithRetry,
    postGroqJsonWithRetry,
    getSafeGroqErrorDetail,
    releaseMediaSlot,
    reserveMediaSlot,
    shouldRetryGroqRequest,
    isUnclearVoiceTranscript
} from '../../lib/chatbotMedia.js';

describe('zero-cost Groq media provider', () => {
    beforeEach(() => {
        settings.clear();
        axiosPost.mockReset();
        vi.useRealTimers();
    });

    it('builds a Qwen vision request with a bounded base64 image payload', () => {
        const payload = createGroqVisionPayload({ prompt: 'Describe this sticker', data: 'base64-image' });
        expect(payload.model).toBe('qwen/qwen3.8-27b');
        expect(payload.messages[0].content[1]).toEqual({
            type: 'image_url',
            image_url: { url: 'data:image/jpeg;base64,base64-image' }
        });
        expect(payload.max_completion_tokens).toBe(160);
    });

    it('recognizes empty and explicit unclear transcripts without rejecting ordinary bracketed text', () => {
        expect(isUnclearVoiceTranscript('')).toBe(true);
        expect(isUnclearVoiceTranscript('  [unclear]  ')).toBe(true);
        expect(isUnclearVoiceTranscript('[UNCLEAR]')).toBe(true);
        expect(isUnclearVoiceTranscript('I dey come')).toBe(false);
        expect(isUnclearVoiceTranscript('[unclear meaning]')).toBe(false);
    });

    it('builds a multipart Whisper request without sending media to a paid provider', () => {
        const form = createGroqAudioForm(Buffer.from('audio-bytes'), 'audio/ogg');
        expect(form.getHeaders()['content-type']).toContain('multipart/form-data');
        const body = form.getBuffer().toString();
        expect(body).toContain('whisper-large-v3-turbo');
        expect(body).toContain('forge-guard-voice-note.ogg');
        expect(body).toContain('Transcribe verbatim');
    });

    it('rebuilds the multipart body for one transient voice transcription retry', async () => {
        vi.useFakeTimers();
        axiosPost
            .mockRejectedValueOnce({ response: { status: 503 } })
            .mockResolvedValueOnce({ data: { text: 'I dey come' } });

        const pending = postGroqAudioWithRetry(Buffer.from('audio-bytes'), 'audio/ogg', 'test-groq-key');
        await vi.waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));
        await vi.advanceTimersByTimeAsync(750);

        await expect(pending).resolves.toMatchObject({ data: { text: 'I dey come' } });
        expect(axiosPost).toHaveBeenCalledTimes(2);
        expect(axiosPost.mock.calls[0][1]).not.toBe(axiosPost.mock.calls[1][1]);
        expect(axiosPost.mock.calls[0][2].headers.Authorization).toBe('Bearer test-groq-key');
    });

    it('retries transient server and network failures, but never retries free-tier quota errors', () => {
        expect(shouldRetryGroqRequest({ response: { status: 503 } })).toBe(true);
        expect(shouldRetryGroqRequest({ response: { status: 502 } })).toBe(true);
        expect(shouldRetryGroqRequest({ code: 'ECONNABORTED' })).toBe(true);
        expect(shouldRetryGroqRequest({ response: { status: 429 } })).toBe(false);
        expect(shouldRetryGroqRequest({ response: { status: 400 } })).toBe(false);
        expect(shouldRetryGroqRequest({ response: { status: 401 } })).toBe(false);
    });

    it('retries one transient 503 and returns the recovered response', async () => {
        vi.useFakeTimers();
        axiosPost
            .mockRejectedValueOnce({ response: { status: 503 } })
            .mockResolvedValueOnce({ data: { choices: [{ message: { content: 'Recovered' } }] } });

        const pending = postGroqJsonWithRetry('https://api.groq.com/openai/v1/chat/completions', {}, {}, 'sticker_vision');
        await vi.waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));
        await vi.advanceTimersByTimeAsync(750);

        await expect(pending).resolves.toMatchObject({ data: { choices: [{ message: { content: 'Recovered' } }] } });
        expect(axiosPost).toHaveBeenCalledTimes(2);
        expect(axiosPost.mock.calls[0][2].timeout).toBe(45_000);
    });

    it('does not retry a 429 free-tier rate-limit response', async () => {
        axiosPost.mockRejectedValue({ response: { status: 429, data: { error: { message: 'rate limit reached' } } } });
        await expect(postGroqJsonWithRetry('https://api.groq.com/openai/v1/chat/completions', {}, {}, 'sticker_vision'))
            .rejects.toMatchObject({ response: { status: 429 } });
        expect(axiosPost).toHaveBeenCalledTimes(1);
    });

    it('sanitizes provider diagnostics and bounds logged error details', () => {
        const result = getSafeGroqErrorDetail({
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

    it('releases reserved daily usage after a failed provider attempt', async () => {
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
