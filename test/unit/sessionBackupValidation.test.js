import { describe, expect, it } from 'vitest';
import { isValidAuthJson } from '../../lib/sessionBackup.js';

describe('Baileys auth-state JSON validation', () => {
    it('accepts object-root auth state files', () => {
        expect(isValidAuthJson('{"key":"value"}', 'creds.json')).toBe(true);
        expect(isValidAuthJson('{"key":"value"}', 'session-abc.json')).toBe(true);
    });

    it('accepts string-root values for forward and reverse LID mappings', () => {
        expect(isValidAuthJson('"1234567890"', 'lid-mapping-1234567890.json')).toBe(true);
        expect(isValidAuthJson('"1234567890"', 'lid-mapping-1234567890_reverse.json')).toBe(true);
    });

    it('rejects string-root JSON for non-LID auth files', () => {
        expect(isValidAuthJson('"unexpected"', 'creds.json')).toBe(false);
        expect(isValidAuthJson('"unexpected"', 'session-abc.json')).toBe(false);
    });

    it('rejects malformed, empty, and scalar non-string JSON', () => {
        expect(isValidAuthJson('{broken', 'lid-mapping-123.json')).toBe(false);
        expect(isValidAuthJson('', 'lid-mapping-123.json')).toBe(false);
        expect(isValidAuthJson('123', 'lid-mapping-123.json')).toBe(false);
        expect(isValidAuthJson('true', 'lid-mapping-123.json')).toBe(false);
        expect(isValidAuthJson('null', 'lid-mapping-123.json')).toBe(false);
    });
});
