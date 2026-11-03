import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config.js', () => ({
    default: { ownerNumber: '923001234567@s.whatsapp.net', creatorNumber: '2349034451454@s.whatsapp.net' }
}));

vi.mock('../../lib/index.js', () => ({
    isSudo: vi.fn(async () => false)
}));

describe('isOwnerOrSudo', () => {
    let isOwnerOrSudo, isOwnerOnly, cleanJid;

    beforeEach(async () => {
        vi.resetModules();
        const mod = await import('../../lib/isOwner.js');
        isOwnerOrSudo = mod.default;
        isOwnerOnly = mod.isOwnerOnly;
        cleanJid = mod.cleanJid;
    });

    it('owner JID matches', async () => {
        expect(await isOwnerOrSudo('923001234567@s.whatsapp.net')).toBe(true);
    });

    it('owner with device suffix matches', async () => {
        expect(await isOwnerOrSudo('923001234567:10@s.whatsapp.net')).toBe(true);
    });

    it('configured Creator number is accepted as owner', async () => {
        expect(await isOwnerOrSudo('2349034451454@s.whatsapp.net')).toBe(true);
        expect(isOwnerOnly('2349034451454:12@s.whatsapp.net')).toBe(true);
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
});
