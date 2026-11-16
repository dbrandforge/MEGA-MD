import { describe, expect, it, vi } from 'vitest';
import { createBoundedMessageStore } from '../../lib/boundedMessageStore.js';

describe('bounded anti-delete message cache', () => {
    it('evicts the least-recently-used entry when the capacity is reached', () => {
        const onEvict = vi.fn();
        const cache = createBoundedMessageStore({ maxEntries: 2, ttlMs: 1000, onEvict });
        cache.set('one', { content: '1' });
        cache.set('two', { content: '2' });
        expect(cache.get('one')).toEqual({ content: '1' });
        cache.set('three', { content: '3' });

        expect(cache.get('one')).toEqual({ content: '1' });
        expect(cache.get('two')).toBeUndefined();
        expect(cache.get('three')).toEqual({ content: '3' });
        expect(onEvict).toHaveBeenCalledWith({ content: '2' }, 'two', 'capacity');
        expect(cache.size).toBe(2);
    });

    it('expires old records and invokes cleanup for their media files', () => {
        let now = 1000;
        const onEvict = vi.fn();
        const cache = createBoundedMessageStore({
            maxEntries: 10,
            ttlMs: 100,
            now: () => now,
            onEvict
        });
        cache.set('media', { mediaPath: '/tmp/media.jpg' });
        now += 101;

        expect(cache.get('media')).toBeUndefined();
        expect(cache.size).toBe(0);
        expect(onEvict).toHaveBeenCalledWith({ mediaPath: '/tmp/media.jpg' }, 'media', 'expired');
    });

    it('prunes expired entries in bulk and cleans media on explicit deletion', () => {
        let now = 0;
        const onEvict = vi.fn();
        const cache = createBoundedMessageStore({ ttlMs: 10, now: () => now, onEvict });
        cache.set('old', { mediaPath: '/tmp/old.jpg' });
        cache.set('new', { content: 'new' });
        now = 11;

        expect(cache.prune()).toBe(2);
        expect(cache.size).toBe(0);
        expect(onEvict).toHaveBeenCalledTimes(2);
    });
});
