import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { settings } = vi.hoisted(() => ({ settings: new Map() }));

vi.mock('../../lib/lightweight_store.js', () => ({
    default: {
        async getSetting(chatId, key) {
            return settings.get(`${chatId}:${key}`) ?? null;
        },
        async saveSetting(chatId, key, value) {
            settings.set(`${chatId}:${key}`, structuredClone(value));
        },
        async saveSettingVerified(chatId, key, value) {
            settings.set(`${chatId}:${key}`, structuredClone(value));
            return true;
        }
    }
}));

import { getChatbotMediaModes, setChatbotMediaMode } from '../../lib/chatbotMediaSettings.js';
import { normalizeVoiceMimeType, reserveMediaSlot } from '../../lib/chatbotMedia.js';

describe('chatbot media settings and audio handling', () => {
    let testDay = 0;
    beforeEach(() => {
        settings.clear();
        testDay++;
        vi.useFakeTimers();
        vi.setSystemTime(new Date(Date.UTC(2026, 10, 12 + testDay, 12, 0, 0)));
    });
    afterEach(() => vi.useRealTimers());

    it('keeps both media features disabled by default', async () => {
        await expect(getChatbotMediaModes('120363000000000000@g.us')).resolves.toEqual({
            stickers: false,
            voiceNotes: false
        });
    });

    it('persists sticker and voice-note settings independently per chat', async () => {
        const groupA = '120363000000000001@g.us';
        const groupB = '120363000000000002@g.us';

        await expect(setChatbotMediaMode(groupA, 'stickers', true)).resolves.toBe(true);
        await expect(setChatbotMediaMode(groupA, 'voiceNotes', true)).resolves.toBe(true);

        await expect(getChatbotMediaModes(groupA)).resolves.toEqual({
            stickers: true,
            voiceNotes: true
        });
        await expect(getChatbotMediaModes(groupB)).resolves.toEqual({
            stickers: false,
            voiceNotes: false
        });
    });

    it('enforces persisted global and per-chat voice-note ceilings', async () => {
        for (let i = 0; i < 20; i++) {
            await expect(reserveMediaSlot('group-a', `member-${i}`, 'voice')).resolves.toBe(true);
        }
        await expect(reserveMediaSlot('group-a', 'member-overflow', 'voice')).resolves.toBe(false);

        for (let i = 0; i < 10; i++) {
            await expect(reserveMediaSlot(`group-${i + 1}`, `member-${i + 20}`, 'voice')).resolves.toBe(true);
        }
        await expect(reserveMediaSlot('group-global-overflow', 'member-global-overflow', 'voice')).resolves.toBe(false);
    });

    it('enforces the expanded sticker sender, chat, and global ceilings', async () => {
        for (let i = 0; i < 30; i++) {
            await expect(reserveMediaSlot('sticker-group-a', `member-${i}`, 'sticker')).resolves.toBe(true);
        }
        await expect(reserveMediaSlot('sticker-group-a', 'member-overflow', 'sticker')).resolves.toBe(false);

        for (let i = 0; i < 20; i++) {
            await expect(reserveMediaSlot(`sticker-group-${i + 1}`, `sticker-member-${i}`, 'sticker')).resolves.toBe(true);
        }
        await expect(reserveMediaSlot('sticker-global-overflow', 'sticker-global-overflow', 'sticker')).resolves.toBe(false);
    });

    it('rejects unknown media settings', async () => {
        await expect(setChatbotMediaMode('chat', 'video', true)).resolves.toBe(false);
    });

    it('normalizes WhatsApp Opus voice notes to the OGG container MIME type', () => {
        expect(normalizeVoiceMimeType('audio/ogg; codecs=opus')).toBe('audio/ogg');
    });

    it('normalizes Groq-supported audio MIME types to provider-compatible values', () => {
        expect(normalizeVoiceMimeType('audio/mp3')).toBe('audio/mpeg');
        expect(normalizeVoiceMimeType('audio/mpeg')).toBe('audio/mpeg');
        expect(normalizeVoiceMimeType('audio/mpga')).toBe('audio/mpeg');
        expect(normalizeVoiceMimeType('audio/wav')).toBe('audio/wav');
        expect(normalizeVoiceMimeType('audio/x-wav')).toBe('audio/wav');
        expect(normalizeVoiceMimeType('audio/mp4')).toBe('audio/mp4');
        expect(normalizeVoiceMimeType('audio/m4a')).toBe('audio/mp4');
        expect(normalizeVoiceMimeType('audio/webm')).toBe('audio/webm');
        expect(normalizeVoiceMimeType('audio/flac')).toBe('audio/flac');
    });

    it('rejects unsupported or non-audio MIME types instead of guessing', () => {
        expect(normalizeVoiceMimeType('audio/aac')).toBeNull();
        expect(normalizeVoiceMimeType('video/mp4')).toBeNull();
        expect(normalizeVoiceMimeType('')).toBeNull();
    });
});
