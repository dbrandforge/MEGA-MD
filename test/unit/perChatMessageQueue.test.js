import { describe, expect, it, vi } from 'vitest';
import { createPerChatMessageQueue } from '../../lib/perChatMessageQueue.js';

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

describe('bounded per-chat message queue', () => {
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

    it('rejects overflow explicitly and reports whether the per-chat or global cap was reached', async () => {
        const gate = deferred();
        const onOverflow = vi.fn();
        const queue = createPerChatMessageQueue({
            maxConcurrentChats: 1,
            maxQueuePerChat: 1,
            maxQueueTotal: 1,
            processMessage: async () => gate.promise,
            onOverflow
        });

        expect(queue.enqueue('group-a', { id: 'active' })).toBe(true);
        await Promise.resolve();
        await Promise.resolve();
        expect(queue.enqueue('group-a', { id: 'queued' })).toBe(true);
        expect(queue.enqueue('group-a', { id: 'overflow' })).toBe(false);
        expect(onOverflow).toHaveBeenCalledWith(expect.objectContaining({
            chatId: 'group-a',
            reason: 'chat-limit'
        }));

        gate.resolve();
        await vi.waitFor(() => expect(queue.getStats()).toMatchObject({ active: 0, pending: 0 }));
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
