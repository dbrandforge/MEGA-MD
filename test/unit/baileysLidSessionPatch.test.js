import { describe, expect, it } from 'vitest';
import { patchLargeSessionDiagnostics, patchMessagesReceive, patchMessagesSend } from '../../scripts/patch-baileys-lid-sessions.js';

describe('Baileys LID session compatibility patch', () => {
    it('does not force-recreate every mapped LID session during device lookup', () => {
        const input = 'await assertSessions(lids, true);';
        const result = patchMessagesSend(input);
        expect(result.source).toBe('await assertSessions(lids);');
        expect(result.changed).toBe(true);
        expect(patchMessagesSend(result.source).changed).toBe(false);
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
        ].join('\\n');
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
