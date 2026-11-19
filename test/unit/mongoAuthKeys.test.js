import { describe, it, expect } from 'vitest';
import { createMongoKeyStore, authKeyFilename } from '../../lib/mongoAuthKeys.js';

const BufferJSON = {
    replacer: (_k, v) => (Buffer.isBuffer(v) || v?.type === 'Buffer') ? { type: 'Buffer', data: Buffer.from(v.data ?? v).toString('base64') } : v,
    reviver: (_k, v) => v?.type === 'Buffer' ? Buffer.from(v.data, 'base64') : v,
};
function fakeModel() {
    const db = new Map();
    const stats = { bulk: 0, finds: 0 };
    return {
        db, stats,
        find: q => ({ select: () => ({ lean: async () => { stats.finds++; return q.filename.$in.filter(f => db.has(f)).map(f => ({ filename: f, content: db.get(f) })); } }) }),
        bulkWrite: async ops => {
            stats.bulk++;
            for (const op of ops) {
                if (op.deleteOne) db.delete(op.deleteOne.filter.filename);
                else db.set(op.updateOne.filter.filename, op.updateOne.update.$set.content);
            }
        },
    };
}

describe('mongo auth key store', () => {
    it('uses the same filenames as the multi-file auth state', () => {
        expect(authKeyFilename('session', '123:4/5')).toBe('session-123-4__5.json');
    });

    it('serves writes from memory, flushes only changes, and round-trips buffers', async () => {
        const model = fakeModel();
        const store = createMongoKeyStore({ getModel: async () => model, BufferJSON, proto: null, flushMs: 10 });
        await store.set({ session: { a: Buffer.from('hi') }, 'pre-key': { 1: { x: 1 } } });
        expect((await store.get('pre-key', ['1']))['1'].x).toBe(1);
        expect(model.stats.finds).toBe(0);
        await store.flush();
        await store.flush();
        expect(model.stats.bulk).toBe(1);
        const fresh = createMongoKeyStore({ getModel: async () => model, BufferJSON, proto: null, flushMs: 10 });
        const got = await fresh.get('session', ['a', 'missing']);
        expect(Buffer.from(got.a).toString()).toBe('hi');
        expect(got.missing).toBeUndefined();
        store.close(); fresh.close();
    });

    it('deletes keys and holds writes while not the active writer', async () => {
        const model = fakeModel();
        const store = createMongoKeyStore({ getModel: async () => model, BufferJSON, proto: null, flushMs: 10 });
        await store.set({ 'pre-key': { 1: { x: 1 } } });
        await store.flush();
        await store.set({ 'pre-key': { 1: null } });
        await store.flush();
        expect(model.db.has('pre-key-1.json')).toBe(false);
        const held = createMongoKeyStore({ getModel: async () => model, canWrite: async () => false, BufferJSON, proto: null, flushMs: 10 });
        await held.set({ 'pre-key': { 9: { z: 9 } } });
        await held.flush();
        expect(model.db.has('pre-key-9.json')).toBe(false);
        expect(held.pendingCount()).toBe(1);
        store.close(); held.close();
    });
});
