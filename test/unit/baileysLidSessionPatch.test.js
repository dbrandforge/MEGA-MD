import { describe, expect, it } from 'vitest';
import { patchMessagesReceive, patchMessagesSend } from '../../scripts/patch-baileys-lid-sessions.js';

describe('Baileys LID session compatibility patch', () => {
    it('does not force-recreate every mapped LID session during device lookup', () => {
        const input = 'await assertSessions(lids, true);';
        const result = patchMessagesSend(input);
        expect(result.source).toBe('await assertSessions(lids);');
        expect(result.changed).toBe(true);
        expect(patchMessagesSend(result.source).changed).toBe(false);
    });

    it('includes key material in the first decrypt retry request', () => {
        const input = [
            'const encNode = getBinaryNodeChild(node, \'enc\');',
            'await sendRetryRequest(node, !encNode);',
            'const after = true;'
        ].join('\\n');
        const result = patchMessagesReceive(input);
        expect(result.source).toContain('await sendRetryRequest(node, true);');
        expect(result.changed).toBe(true);
        expect(patchMessagesReceive(result.source).changed).toBe(false);
    });

    it('uses the actual group participant rather than the group JID for retry session recovery', () => {
        const input = [
            'const sendRetryRequest = async (node) => {',
            'const fromJid = node.attrs.from;',
            'const sessionId = signalRepository.jidToSignalProtocolAddress(fromJid);',
            '};'
        ].join('\\n');
        const result = patchMessagesReceive(input);
        expect(result.source).toContain('const fromJid = node.attrs.participant || node.attrs.from;');
        expect(result.changed).toBe(true);
    });

    it('fails closed if the installed Baileys source shape changes unexpectedly', () => {
        expect(() => patchMessagesSend('unrecognized dependency source')).toThrow();
        expect(() => patchMessagesReceive('unrecognized dependency source')).toThrow();
    });
});
