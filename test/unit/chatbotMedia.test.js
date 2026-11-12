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

import {
    getChatbotMediaModes,
    normalizeVoiceMimeType,
    reserveMediaSlot,
    setChatbotMediaMode
} from '../../lib/chatbotMedia.js';

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
        for (let i = 0; i < 5; i++) {
            await expect(reserveMediaSlot('group-a', `member-${i}`, 'voice')).resolves.toBe(true);
        }
        await expect(reserveMediaSlot('group-a', 'member-overflow', 'voice')).resolves.toBe(false);

        for (let i = 0; i < 5; i++) {
            await expect(reserveMediaSlot(`group-${i + 1}`, `member-${i + 5}`, 'voice')).resolves.toBe(true);
        }
        await expect(reserveMediaSlot('group-global-overflow', 'member-global-overflow', 'voice')).resolves.toBe(false);
    });

    it('rejects unknown media settings', async () => {
        await expect(setChatbotMediaMode('chat', 'video', true)).resolves.toBe(false);
    });

    it('normalizes WhatsApp Opus voice notes to the OGG container MIME type', () => {
        expect(normalizeVoiceMimeType('audio/ogg; codecs=opus')).toBe('audio/ogg');
    });

    it('accepts supported audio MIME types', () => {
        expect(normalizeVoiceMimeType('audio/mp3')).toBe('audio/mp3');
        expect(normalizeVoiceMimeType('audio/mpeg')).toBe('audio/mp3');
        expect(normalizeVoiceMimeType('audio/wav')).toBe('audio/wav');
        expect(normalizeVoiceMimeType('audio/aac')).toBe('audio/aac');
        expect(normalizeVoiceMimeType('audio/flac')).toBe('audio/flac');
    });

    it('rejects unsupported or non-audio MIME types instead of guessing', () => {
        expect(normalizeVoiceMimeType('audio/webm')).toBeNull();
        expect(normalizeVoiceMimeType('video/mp4')).toBeNull();
        expect(normalizeVoiceMimeType('')).toBeNull();
    });
});
