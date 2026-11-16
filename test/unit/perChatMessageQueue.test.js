import { describe, expect, it, vi } from 'vitest';
import { createPerChatMessageQueue } from '../../lib/perChatMessageQueue.js';

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

describe('per-chat message queue', () => {
    it('preserves FIFO order within a chat while allowing different chats to run concurrently', async () => {
        const firstGate = deferred();
        const started = [];
        const completed = [];
        const queue = createPerChatMessageQueue({
            maxConcurrentChats: 2,
            processMessage: async item => {
                started.push(item.id);
                if (item.id === 'a1') await firstGate.promise;
                completed.push(item.id);
            }
        });

        queue.enqueue('group-a', { id: 'a1' });
        queue.enqueue('group-a', { id: 'a2' });
        queue.enqueue('group-b', { id: 'b1' });

        await Promise.resolve();
        await Promise.resolve();
        expect(started).toEqual(['a1', 'b1']);
        expect(queue.getStats().active).toBe(2);
        expect(queue.getStats().pending).toBe(1);

        firstGate.resolve();
        await vi.waitFor(() => expect(completed).toEqual(['b1', 'a1', 'a2']));
        expect(started).toEqual(['a1', 'b1', 'a2']);
        expect(queue.getStats()).toMatchObject({ active: 0, pending: 0, chats: 0 });
    });

    it('accepts and drains large bursts without rejecting messages due to queue depth', async () => {
        const gate = deferred();
        const processed = [];
        const queue = createPerChatMessageQueue({
            maxConcurrentChats: 1,
            processMessage: async item => {
                if (item.id === 0) await gate.promise;
                processed.push(item.id);
            }
        });

        expect(queue.enqueue('large-group', { id: 0 })).toBe(true);
        await Promise.resolve();
        await Promise.resolve();
        for (let id = 1; id <= 1200; id++) {
            expect(queue.enqueue('large-group', { id })).toBe(true);
        }
        expect(queue.getStats().pending).toBe(1200);

        gate.resolve();
        await vi.waitFor(() => expect(processed).toHaveLength(1201));
        expect(processed).toEqual(Array.from({ length: 1201 }, (_, id) => id));
        expect(queue.getStats()).toMatchObject({ active: 0, pending: 0 });
    });

    it('continues draining after a message processor throws', async () => {
        const onError = vi.fn();
        const processed = [];
        const queue = createPerChatMessageQueue({
            processMessage: async item => {
                if (item.id === 'bad') throw new Error('expected failure');
                processed.push(item.id);
            },
            onError
        });

        queue.enqueue('group-a', { id: 'bad' });
        queue.enqueue('group-a', { id: 'good' });
        await vi.waitFor(() => expect(processed).toEqual(['good']));
        expect(onError).toHaveBeenCalledTimes(1);
        expect(queue.getStats()).toMatchObject({ active: 0, pending: 0 });
    });
});
