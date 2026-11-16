import { describe, expect, it } from 'vitest';
import { chunkOperations, DEFAULT_LEADERSHIP_WAIT_MS, summarizeAuthStateInventory } from '../../lib/sessionBackup.js';

describe('session-backup leadership takeover', () => {
    it('waits longer than the full five-minute snapshot lease before aborting startup', () => {
        expect(DEFAULT_LEADERSHIP_WAIT_MS).toBe(6 * 60 * 1000);
        expect(DEFAULT_LEADERSHIP_WAIT_MS).toBeGreaterThan(5 * 60 * 1000);
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


describe('incremental session backup batching', () => {
    it('splits large recipient-session updates into bounded bulk-write batches', () => {
        const operations = Array.from({ length: 981 }, (_, index) => ({ updateOne: { filter: { filename: `session-${index}.json` } } }));
        const batches = chunkOperations(operations, 250);
        expect(batches.map(batch => batch.length)).toEqual([250, 250, 250, 231]);
        expect(batches.flat()).toEqual(operations);
    });

    it('returns no batches for invalid input and handles an empty change set', () => {
        expect(chunkOperations([], 250)).toEqual([]);
        expect(chunkOperations(null, 250)).toEqual([]);
        expect(chunkOperations([{ updateOne: {} }], 0)).toEqual([]);
    });
});
