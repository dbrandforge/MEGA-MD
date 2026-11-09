import { describe, expect, it } from 'vitest';
import { summarizeAuthStateInventory } from '../../lib/sessionBackup.js';

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
