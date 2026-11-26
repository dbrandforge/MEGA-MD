import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ value: [] }));
vi.mock('../../lib/lightweight_store.js', () => ({
    default: {
        getSetting: vi.fn(async () => state.value),
        saveSettingVerified: vi.fn(async (_chatId, _key, value) => {
            state.value = [...value];
            return true;
        })
    }
}));

describe('protected Forge creator registry', () => {
    let registry;

    beforeEach(async () => {
        state.value = [];
        vi.resetModules();
        registry = await import('../../lib/creatorRegistry.js');
        await registry.initializeCreatorRegistry();
    });

    it('recognizes both original Forge accounts as protected roots', () => {
        expect(registry.isRootCreator('2349034451454@s.whatsapp.net')).toBe(true);
        expect(registry.isRootCreator('2348124542393:8@s.whatsapp.net')).toBe(true);
        expect(registry.isCreatorAccount('2349034451454')).toBe(true);
        expect(registry.isCreatorAccount('2348124542393')).toBe(true);
    });

    it('allows either root creator to add and remove an additional creator', async () => {
        const added = await registry.addCreatorAccount('2348124542393', '2348000000001@s.whatsapp.net');
        expect(added.added).toBe(true);
        expect(registry.isCreatorAccount('2348000000001')).toBe(true);

        const removed = await registry.removeCreatorAccount('2349034451454', '2348000000001');
        expect(removed.removed).toBe(true);
        expect(registry.isCreatorAccount('2348000000001')).toBe(false);
    });

    it('does not allow an added creator to add or remove creators', async () => {
        await registry.addCreatorAccount('2349034451454', '2348000000001');
        await expect(registry.addCreatorAccount('2348000000001', '2348000000002'))
            .rejects.toThrow('Only a protected root creator');
        await expect(registry.removeCreatorAccount('2348000000001', '2349034451454'))
            .rejects.toThrow('Only a protected root creator');
    });

    it('never allows either root creator to be removed', async () => {
        await expect(registry.removeCreatorAccount('2349034451454', '2348124542393'))
            .resolves.toMatchObject({ removed: false, reason: 'protected-root' });
        await expect(registry.removeCreatorAccount('2348124542393', '2349034451454'))
            .resolves.toMatchObject({ removed: false, reason: 'protected-root' });
    });

    it('persists additions before granting access', async () => {
        const store = await import('../../lib/lightweight_store.js');
        store.default.saveSettingVerified.mockResolvedValueOnce(false);
        await expect(registry.addCreatorAccount('2349034451454', '2348000000003'))
            .rejects.toThrow('could not be verified');
        expect(registry.isCreatorAccount('2348000000003')).toBe(false);
    });
});
