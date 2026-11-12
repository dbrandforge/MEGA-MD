import { describe, expect, it } from 'vitest';
import { normalizeVoiceMimeType } from '../../lib/chatbotMedia.js';

describe('chatbot media audio handling', () => {
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
