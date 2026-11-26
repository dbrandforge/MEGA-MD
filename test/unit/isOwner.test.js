import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../config.js', () => ({
    default: { ownerNumber: '2349034451454@s.whatsapp.net', creatorNumber: '2349034451454@s.whatsapp.net' }
}));

vi.mock('../../lib/index.js', () => ({
    isSudo: vi.fn(async () => false)
}));

describe('isOwnerOrSudo', () => {
    let isOwnerOrSudo, isOwnerOnly, cleanJid, invalidateGroupMetadataCache;

    beforeEach(async () => {
        vi.resetModules();
        const mod = await import('../../lib/isOwner.js');
        isOwnerOrSudo = mod.default;
        isOwnerOnly = mod.isOwnerOnly;
        cleanJid = mod.cleanJid;
        invalidateGroupMetadataCache = mod.invalidateGroupMetadataCache;
    });

    afterEach(() => vi.unstubAllEnvs());

    it('owner JID matches', async () => {
        expect(await isOwnerOrSudo('2349034451454@s.whatsapp.net')).toBe(true);
    });

    it('owner with device suffix matches', async () => {
        expect(await isOwnerOrSudo('2349034451454:10@s.whatsapp.net')).toBe(true);
    });

    it('main Forge account is accepted as root creator', async () => {
        expect(await isOwnerOrSudo('2349034451454@s.whatsapp.net')).toBe(true);
        expect(isOwnerOnly('2349034451454:12@s.whatsapp.net')).toBe(true);
    });

    it('the second protected Forge account is accepted as root creator', async () => {
        expect(await isOwnerOrSudo('2348124542393@s.whatsapp.net')).toBe(true);
        expect(isOwnerOnly('2348124542393:4@s.whatsapp.net')).toBe(true);
    });

    it('unregistered legacy owner and CREATOR_NUMBERS values are not granted creator access', async () => {
        vi.stubEnv('CREATOR_NUMBERS', '2348000000001,2348000000002');
        vi.resetModules();
        const mod = await import('../../lib/isOwner.js');
        expect(await mod.default('2348000000001@s.whatsapp.net')).toBe(false);
        expect(await mod.default('923001234567@s.whatsapp.net')).toBe(false);
        expect(mod.isOwnerOnly('2348000000002@s.whatsapp.net')).toBe(false);
    });

    it('The Queen is not granted owner permissions', async () => {
        expect(await isOwnerOrSudo('2348126885208@s.whatsapp.net')).toBe(false);
        expect(isOwnerOnly('2348126885208@s.whatsapp.net')).toBe(false);
    });

    it('non-owner returns false', async () => {
        expect(await isOwnerOrSudo('911111111111@s.whatsapp.net')).toBe(false);
    });

    it('isOwnerOnly rejects sudo', async () => {
        expect(isOwnerOnly('911111111111@s.whatsapp.net')).toBe(false);
    });

    it('cleanJid strips device suffix', () => {
        expect(cleanJid('923001234567:10@s.whatsapp.net')).toBe('923001234567');
    });

    it('cleanJid strips @s.whatsapp.net', () => {
        expect(cleanJid('923001234567@s.whatsapp.net')).toBe('923001234567');
    });

    it('cleanJid handles empty string', () => {
        expect(cleanJid('')).toBe('');
    });

    it('reuses group metadata for repeated unresolved LID checks in the same group', async () => {
        const sock = {
            groupMetadata: vi.fn(async () => ({
                participants: [{ lid: 'owner-lid@lid', id: '923001234567@s.whatsapp.net' }]
            }))
        };
        expect(await isOwnerOrSudo('owner-lid@lid', sock, 'group-1@g.us')).toBe(true);
        expect(await isOwnerOrSudo('owner-lid@lid', sock, 'group-1@g.us')).toBe(true);
        expect(sock.groupMetadata).toHaveBeenCalledTimes(1);
    });

    it('backs off repeated WhatsApp rate-limited group metadata requests', async () => {
        const rateLimit = Object.assign(new Error('rate-overlimit'), { data: 429 });
        const sock = { groupMetadata: vi.fn(async () => { throw rateLimit; }) };

        expect(await isOwnerOrSudo('owner-lid@lid', sock, 'group-rate-limit@g.us')).toBe(false);
        expect(await isOwnerOrSudo('owner-lid@lid', sock, 'group-rate-limit@g.us')).toBe(false);
        expect(sock.groupMetadata).toHaveBeenCalledTimes(1);
    });

    it('invalidates cached group metadata after participant changes', async () => {
        const sock = {
            groupMetadata: vi.fn(async () => ({
                participants: [{ lid: 'owner-lid@lid', id: '923001234567@s.whatsapp.net' }]
            }))
        };
        await isOwnerOrSudo('owner-lid@lid', sock, 'group-2@g.us');
        invalidateGroupMetadataCache('group-2@g.us');
        await isOwnerOrSudo('owner-lid@lid', sock, 'group-2@g.us');
        expect(sock.groupMetadata).toHaveBeenCalledTimes(2);
    });

});
