import { describe, it, beforeAll, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Settings Persistence', () => {
    let store;

    beforeAll(async () => {
        const mod = await import('../../lib/lightweight_store.js');
        store = mod.default;
    });

    const keys = ['autoStatus','autoread','autotyping','pmblocker','anticall','stealthMode','autoBio','autoReaction'];

    it('verifies persistence for arrays and flat objects without an enabled field', async () => {
        const group = '120363000000000001@g.us';
        const trackedGroups = [group];
        const softMutes = {
            '2348000000000@s.whatsapp.net': { until: Date.now() + 60_000 }
        };

        expect(await store.saveSettingVerified('global', 'verifiedTrackedGroupsTest', trackedGroups)).toBe(true);
        expect(await store.saveSettingVerified(group, 'verifiedSoftMutesTest', softMutes)).toBe(true);
        expect(await store.getSetting('global', 'verifiedTrackedGroupsTest')).toEqual(trackedGroups);
        expect(await store.getSetting(group, 'verifiedSoftMutesTest')).toEqual(softMutes);

        for (const key of ['verifiedTrackedGroupsTest', 'verifiedSoftMutesTest']) {
            const filePath = path.join(process.cwd(), 'data', `${key}.json`);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
    });

    for (const key of keys) {
        it(`saves and reads ${key}`, async () => {
            await store.saveSetting('global', key, { enabled: true });
            const val = await store.getSetting('global', key);
            expect(val?.enabled).toBe(true);

            await store.saveSetting('global', key, { enabled: false });
            const val2 = await store.getSetting('global', key);
            expect(val2?.enabled).toBe(false);

            const filePath = path.join(process.cwd(), 'data', `${key}.json`);
            if (fs.existsSync(filePath)) {
                const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                expect('global' in raw).toBe(false);
                expect('enabled' in raw).toBe(true);
            }
        });
    }
});
