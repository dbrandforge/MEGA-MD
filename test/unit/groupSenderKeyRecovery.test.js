import { describe, expect, it, vi } from 'vitest';
import { parseGroupSenderKeyRecoveryTargets, resetGroupSenderKeyMemoryBeforeSend } from '../lib/groupSenderKeyRecovery.js';

describe('group Sender Key recovery', () => {
    it('accepts only explicit group JIDs from the configured list', () => {
        const targets = parseGroupSenderKeyRecoveryTargets('120363420924358296@g.us, invalid, 123@s.whatsapp.net');
        expect([...targets]).toEqual(['120363420924358296@g.us']);
    });

    it('does not touch private chats or unconfigured groups', async () => {
        const set = vi.fn();
        const keyStore = { set };
        const targets = parseGroupSenderKeyRecoveryTargets('120363420924358296@g.us');

        await expect(resetGroupSenderKeyMemoryBeforeSend('123@s.whatsapp.net', keyStore, targets)).resolves.toBe(false);
        await expect(resetGroupSenderKeyMemoryBeforeSend('120363420924358297@g.us', keyStore, targets)).resolves.toBe(false);
        expect(set).not.toHaveBeenCalled();
    });

    it('invalidates only the configured group Sender Key memory', async () => {
        const set = vi.fn().mockResolvedValue(undefined);
        const keyStore = { set };
        const jid = '120363420924358296@g.us';
        const targets = parseGroupSenderKeyRecoveryTargets(jid);

        await expect(resetGroupSenderKeyMemoryBeforeSend(jid, keyStore, targets)).resolves.toBe(true);
        expect(set).toHaveBeenCalledWith({ 'sender-key-memory': { [jid]: null } });
    });
});
