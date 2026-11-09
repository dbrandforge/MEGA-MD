import { describe, it, expect, vi } from 'vitest';
import { isSensitiveSignalDiagnostic, installSignalDiagnosticGuard, classifySignalDiagnostic } from '../../lib/signalDiagnostics.js';

describe('Signal diagnostic log protection', () => {
    it('suppresses known decryption diagnostics', () => {
        expect(isSensitiveSignalDiagnostic(['Failed to decrypt message with any known session'])).toBe(true);
        expect(isSensitiveSignalDiagnostic(['Bad MAC'])).toBe(true);
    });

    it('suppresses plain-text fragments containing cryptographic key names', () => {
        expect(isSensitiveSignalDiagnostic(['baseKey: <Buffer redacted>'])).toBe(true);
        expect(isSensitiveSignalDiagnostic(['    remoteIdentityKey: <Buffer redacted>'])).toBe(true);
        expect(isSensitiveSignalDiagnostic(['      privKey: <Buffer redacted>'])).toBe(true);
    });

    it('suppresses nested objects containing cryptographic key fields', () => {
        expect(isSensitiveSignalDiagnostic([{ error: { baseKey: 'must-not-log' } }])).toBe(true);
        expect(isSensitiveSignalDiagnostic([{ record: { remoteIdentityKey: 'must-not-log' } }])).toBe(true);
    });


    it('classifies common Signal failures without returning raw error text', () => {
        expect(classifySignalDiagnostic(['Bad MAC while decrypting'])).toBe('bad_mac');
        expect(classifySignalDiagnostic([new Error('Closing stale open session for outgoing prekey bundle')])).toBe('closed_session');
        expect(classifySignalDiagnostic(['No session found for recipient'])).toBe('no_session');
        expect(classifySignalDiagnostic(['Invalid PreKey ID'])).toBe('prekey_failure');
        expect(classifySignalDiagnostic(['Failed to decrypt message with any known session'])).toBe('decrypt_failed');
    });

    it('allows ordinary application logs', () => {
        expect(isSensitiveSignalDiagnostic(['Message processed successfully'])).toBe(false);
        expect(isSensitiveSignalDiagnostic([{ jid: '123@g.us', status: 'connected' }])).toBe(false);
    });

    it('replaces sensitive diagnostics with a low-detail category and can restore console methods', () => {
        const output = [];
        const fakeConsole = {
            log: (...args) => output.push(args),
            warn: (...args) => output.push(args),
            error: (...args) => output.push(args),
            info: (...args) => output.push(args),
            debug: (...args) => output.push(args),
            dir: (...args) => output.push(args),
            table: (...args) => output.push(args),
            trace: (...args) => output.push(args),
            assert: (...args) => output.push(args),
        };
        const restore = installSignalDiagnosticGuard(fakeConsole);
        fakeConsole.error({ baseKey: 'secret', message: 'Bad MAC' });
        expect(JSON.stringify(output)).not.toContain('secret');
        expect(JSON.stringify(output)).toContain('sensitive diagnostic suppressed');
        restore();
    });
});
