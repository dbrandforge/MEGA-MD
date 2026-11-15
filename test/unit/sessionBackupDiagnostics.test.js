import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DEFAULT_LEADERSHIP_WAIT_MS, summarizeAuthStateInventory, validateSnapshotBaseline } from '../../lib/sessionBackup.js';

function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}

describe('session-backup leadership takeover', () => {
    it('waits longer than the full five-minute snapshot lease before aborting startup', () => {
        expect(DEFAULT_LEADERSHIP_WAIT_MS).toBe(6 * 60 * 1000);
        expect(DEFAULT_LEADERSHIP_WAIT_MS).toBeGreaterThan(5 * 60 * 1000);
    });
});

describe('session-backup manifest integrity', () => {
    const creds = JSON.stringify({
        registered: true,
        noiseKey: {},
        signedIdentityKey: {},
        signedPreKey: {}
    });
    const session = JSON.stringify({ sessions: { device: {} } });
    const manifest = JSON.stringify({
        version: 1,
        files: [
            { filename: 'creds.json', hash: sha256(creds) },
            { filename: 'session-device.json', hash: sha256(session) }
        ]
    });

    it('accepts a manifest only when every referenced auth file exists and matches its hash', () => {
        const baseline = validateSnapshotBaseline(manifest, [
            { filename: 'creds.json', content: creds },
            { filename: 'session-device.json', content: session }
        ]);
        expect(baseline?.size).toBe(2);
    });

    it('rejects a manifest that references a missing file so backup falls back to a full snapshot', () => {
        expect(validateSnapshotBaseline(manifest, [
            { filename: 'creds.json', content: creds }
        ])).toBeNull();
    });

    it('rejects a manifest when a stored file no longer matches its recorded hash', () => {
        expect(validateSnapshotBaseline(manifest, [
            { filename: 'creds.json', content: creds },
            { filename: 'session-device.json', content: JSON.stringify({ sessions: {} }) }
        ])).toBeNull();
    });
});

describe('auth-state inventory diagnostics', () => {
    it('reports aggregate key-file counts without exposing filenames', () => {
        expect(summarizeAuthStateInventory([
            'creds.json',
            'session-device-a.json',
            'session-device-b.json',
            'sender-key-group-a.json',
            'pre-key-1.json',
            'app-state-sync-key-1.json',
            '__snapshot_manifest__.json',
            'not-a-json.txt',
        ])).toEqual({
            total: 6,
            credentials: 1,
            sessions: 2,
            senderKeys: 1,
            preKeys: 1,
            appStateKeys: 1,
            other: 0,
        });
    });
});
