import { describe, expect, it } from 'vitest';
import {
    encryptSensitiveValue,
    decryptSensitiveValue,
    parseAnonymousClient,
    ANONYMOUS_AUDIT_RETENTION_DAYS
} from '../../lib/anonymousAudit.js';

describe('anonymous forensic metadata', () => {
    it('recognizes an Android handset and Chrome browser from the submitted user-agent', () => {
        const result = parseAnonymousClient({
            'user-agent': 'Mozilla/5.0 (Linux; Android 13; SM-A217F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            'accept-language': 'en-NG,en;q=0.9'
        });
        expect(result.browser).toBe('Chrome');
        expect(result.browserVersion).toBe('120.0.0.0');
        expect(result.os).toBe('Android');
        expect(result.osVersion).toBe('13');
        expect(result.deviceType).toBe('mobile');
        expect(result.deviceModel).toBe('SM-A217F');
        expect(result.language).toBe('en-NG,en;q=0.9');
    });

    it('uses Client Hints when the browser supplies platform and model details', () => {
        const result = parseAnonymousClient({
            'user-agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/121.0.0.0 Mobile Safari/537.36',
            'sec-ch-ua-platform': '"Android"',
            'sec-ch-ua-model': '"Pixel 8"',
            'sec-ch-ua-mobile': '?1'
        });
        expect(result.os).toBe('Android');
        expect(result.deviceModel).toBe('Pixel 8');
        expect(result.clientHints.mobile).toBe('?1');
    });

    it('encrypts sensitive values and rejects tampered ciphertext', () => {
        const key = Buffer.alloc(32, 7);
        const encrypted = encryptSensitiveValue('203.0.113.10', key);
        expect(encrypted.algorithm).toBe('aes-256-gcm');
        expect(encrypted.data).not.toContain('203.0.113.10');
        expect(decryptSensitiveValue(encrypted, key)).toBe('203.0.113.10');
        const tampered = { ...encrypted, data: Buffer.from('tampered').toString('base64') };
        expect(() => decryptSensitiveValue(tampered, key)).toThrow();
    });

    it('retains records for a defined, bounded period', () => {
        expect(ANONYMOUS_AUDIT_RETENTION_DAYS).toBe(365);
    });
});
