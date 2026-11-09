import { describe, it, expect, vi } from 'vitest';
import { isSensitiveSignalDiagnostic, installSignalDiagnosticGuard } from '../../lib/signalDiagnostics.js';

describe('Signal diagnostic log protection', () => {
    it('suppresses known decryption diagnostics', () => {
        expect(isSensitiveSignalDiagnostic(['Failed to decrypt message with any known session'])).toBe(true);
        expect(isSensitiveSignalDiagnostic(['Bad MAC'])).toBe(true);
    });

    it('suppresses plain-text fragments containing cryptographic key names', () => {\n        expect(isSensitiveSignalDiagnostic(['baseKey: <Buffer redacted>'])).toBe(true);\n        expect(isSensitiveSignalDiagnostic(['    remoteIdentityKey: <Buffer redacted>'])).toBe(true);\n        expect(isSensitiveSignalDiagnostic(['      privKey: <Buffer redacted>'])).toBe(true);\n    });\n\n    it('suppresses nested objects containing cryptographic key fields', () => {
        expect(isSensitiveSignalDiagnostic([{ error: { baseKey: 'must-not-log' } }])).toBe(true);
        expect(isSensitiveSignalDiagnostic([{ record: { remoteIdentityKey: 'must-not-log' } }])).toBe(true);
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
            error: (...args) => output.push(args),\n            info: (...args) => output.push(args),\n            debug: (...args) => output.push(args),\n            dir: (...args) => output.push(args),\n            table: (...args) => output.push(args),\n            trace: (...args) => output.push(args),\n            assert: (...args) => output.push(args),
        };
        const restore = installSignalDiagnosticGuard(fakeConsole);
        fakeConsole.error({ baseKey: 'secret', message: 'Bad MAC' });
        expect(JSON.stringify(output)).not.toContain('secret');
        expect(JSON.stringify(output)).toContain('sensitive diagnostic suppressed');
        restore();
    });
});
