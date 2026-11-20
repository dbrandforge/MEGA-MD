import { describe, expect, it } from 'vitest';
import { patchLargeSessionDiagnostics, patchLidMappingStore, patchMessagesReceive, patchMessagesSend } from '../../scripts/patch-baileys-lid-sessions.js';

describe('Baileys LID session compatibility patch', () => {
    it('force-refreshes only newly stored LIDs and normally validates known LIDs', () => {
        const input = [
            'const lidResults = result.list.filter(a => !!a.lid);',
            'if (lidResults.length > 0) {',
            "logger.trace('Storing LID maps from device call');",
            'await signalRepository.lidMapping.storeLIDPNMappings(lidResults.map(a => ({ lid: a.lid, pn: a.id })));',
            'try {',
            'const lids = lidResults.map(a => a.lid);',
            'if (lids.length) { await assertSessions(lids, true); }',
            "} catch (e) { logger.warn({ e, count: lidResults.length }, 'failed to assert sessions for newly mapped LIDs'); }",
            '}',
            'const extracted = extractDeviceJids(result.list);'
        ].join('\\n');
        const result = patchMessagesSend(input);
        expect(result.changed).toBe(true);
        expect(result.source).toContain('const stored = await signalRepository.lidMapping.storeLIDPNMappings');
        expect(result.source).toContain('const newLids = lids.filter(isNewlyMapped)');
        expect(result.source).toContain('await assertSessions(newLids, true)');
        expect(result.source).toContain('await assertSessions(knownLids)');
        expect(result.source).not.toContain('await assertSessions(lids, true)');
        expect(patchMessagesSend(result.source).changed).toBe(false);
    });

    it('serializes LID mapping writes and returns only newly mapped pairs', () => {
        const input = [
            'export class LIDMappingStore {',
            'async storeLIDPNMappings(pairs) { return; }',
            '}'
        ].join('\\n');
        const result = patchLidMappingStore(input);
        expect(result.changed).toBe(true);
        expect(result.source).toContain('storeLIDPNMappings returns newly mapped pairs');
        expect(result.source).toContain('const storeQueues = new WeakMap()');
        expect(result.source).toContain('return [...newlyMapped].map');
        expect(patchLidMappingStore(result.source).changed).toBe(false);
    });

    it('reports why large recipient session sets are being fetched without logging JIDs', () => {
        const input = [
            'const assertSessions = async (jids, force) => {',
            'const uniqueJids = [...new Set(jids)];',
            'const jidsRequiringFetch = [];',
            'for (const jid of uniqueJids) {',
            'if (!force) {',
            'const sessionValidation = await signalRepository.validateSession(jid);',
            'if (sessionValidation.exists) {',
            'continue;',
            '}',
            '}',
            'jidsRequiringFetch.push(jid);',
            '}',
            'if (jidsRequiringFetch.length) {',
            'return true;',
            '}',
            '};'
        ].join(' ');
        const result = patchLargeSessionDiagnostics(input);
        expect(result.changed).toBe(true);
        expect(result.source).toContain('openSessionCount++');
        expect(result.source).toContain("sessionValidation.reason === 'no open session'");
        expect(result.source).toContain('[Baileys session diagnostic]');
        expect(result.source).not.toContain('console.warn(jid');
        expect(patchLargeSessionDiagnostics(result.source).changed).toBe(false);
    });

    it('sends key material on the first decrypt retry and targets the real group participant', () => {
        const input = [
            "const encNode = getBinaryNodeChild(node, 'enc');",
            'await sendRetryRequest(node, !encNode);',
            'const sendRetryRequest = async (node) => {',
            'const fromJid = node.attrs.from;',
            'const sessionId = signalRepository.jidToSignalProtocolAddress(fromJid);',
            '};'
        ].join('\\n');
        const result = patchMessagesReceive(input);
        expect(result.source).toContain('await sendRetryRequest(node, true);');
        expect(result.source).toContain('let fromJid = node.attrs.participant || node.attrs.from;');
        expect(result.source).toContain('signalRepository.lidMapping.getLIDForPN(jidNormalizedUser(fromJid))');
        expect(result.changed).toBe(true);
        expect(patchMessagesReceive(result.source).changed).toBe(false);
    });

    it('fails closed if the installed Baileys source shape changes unexpectedly', () => {
        expect(() => patchMessagesSend('unrecognized dependency source')).toThrow();
        expect(() => patchMessagesReceive('unrecognized dependency source')).toThrow();
    });
});
