import { describe, expect, it } from 'vitest';
import { patchLidMappingStore, patchMessagesSend } from '../../scripts/patch-baileys-lid-sessions.js';

const messagesSendFixture = `
const lidResults = result.list.filter(a => !!a.lid);
if (lidResults.length > 0) {
    logger.trace('Storing LID maps from device call');
    await signalRepository.lidMapping.storeLIDPNMappings(lidResults.map(a => ({ lid: a.lid, pn: a.id })));
    try {
        const lids = lidResults.map(a => a.lid);
        if (lids.length) {
            await assertSessions(lids, true);
        }
    } catch (e) {
        logger.warn({ e, count: lidResults.length }, 'failed to assert sessions for newly mapped LIDs');
    }
}
const extracted = extractDeviceJids(result.list);
`;

describe('Baileys LID session compatibility patch', () => {
    it('force-refreshes only newly stored LIDs and normally validates known LIDs', () => {
        const result = patchMessagesSend(messagesSendFixture);
        expect(result.changed).toBe(true);
        expect(result.source).toContain('const stored = await signalRepository.lidMapping.storeLIDPNMappings');
        expect(result.source).toContain('const newLids = lids.filter(isNewlyMapped)');
        expect(result.source).toContain('await assertSessions(newLids, true)');
        expect(result.source).toContain('await assertSessions(knownLids)');
        expect(result.source).not.toContain('await assertSessions(lids, true)');
    });

    it('is idempotent once the LID refresh guard is installed', () => {
        const first = patchMessagesSend(messagesSendFixture);
        const second = patchMessagesSend(first.source);
        expect(first.changed).toBe(true);
        expect(second.changed).toBe(false);
        expect(second.source).toBe(first.source);
    });

    it('adds a serialized new-mapping result wrapper to LIDMappingStore', () => {
        const fixture = `
export class LIDMappingStore {
    async storeLIDPNMappings(pairs) {
        return;
    }
}
`;
        const result = patchLidMappingStore(fixture);
        expect(result.changed).toBe(true);
        expect(result.source).toContain('storeLIDPNMappings returns newly mapped pairs');
        expect(result.source).toContain('const storeQueues = new WeakMap()');
        expect(result.source).toContain('return [...newlyMapped].map');
    });

    it('does not append the LID mapping wrapper twice', () => {
        const fixture = `
export class LIDMappingStore {
    async storeLIDPNMappings(pairs) {
        return;
    }
}
`;
        const first = patchLidMappingStore(fixture);
        const second = patchLidMappingStore(first.source);
        expect(first.changed).toBe(true);
        expect(second.changed).toBe(false);
        expect(second.source).toBe(first.source);
    });

    it('refuses to patch an unknown Baileys source shape', () => {
        expect(() => patchMessagesSend('const unrelated = true;')).toThrow(/store call was not found/);
    });
});
