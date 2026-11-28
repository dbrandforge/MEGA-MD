export function createPerChatMessageQueue({
    processMessage,
    onError = () => {},
    maxConcurrentChats = 4,
} = {}) {
    if (typeof processMessage !== 'function') {
        throw new TypeError('A processMessage function is required.');
    }

    const queues = new Map();
    const readyChats = [];
    const readySet = new Set();
    let active = 0;
    let pending = 0;
    let generation = 0;

    const isCurrent = token => token === generation;

    function getStats() {
        return { active, pending, chats: queues.size, maxConcurrentChats, generation };
    }

    function scheduleChat(chatId) {
        if (readySet.has(chatId)) return;
        readySet.add(chatId);
        readyChats.push(chatId);
    }

    function pump() {
        while (active < maxConcurrentChats && readyChats.length) {
            const chatId = readyChats.shift();
            readySet.delete(chatId);
            const queue = queues.get(chatId);
            if (!queue || queue.running || !queue.items.length) continue;

            const queued = queue.items.shift();
            pending--;
            queue.running = true;
            active++;

            Promise.resolve()
                .then(() => {
                    if (!isCurrent(queued.generation)) return;
                    return processMessage(queued.item, chatId, {
                        generation: queued.generation,
                        isCurrent: () => isCurrent(queued.generation)
                    });
                })
                .catch(error => {
                    try { onError(error, queued.item, chatId); } catch {}
                })
                .finally(() => {
                    active--;
                    queue.running = false;
                    if (queue.items.length) scheduleChat(chatId);
                    else if (queues.get(chatId) === queue) queues.delete(chatId);
                    pump();
                });
        }
    }

    function enqueue(chatId, item) {
        if (typeof chatId !== 'string' || !chatId || !item) return false;
        let queue = queues.get(chatId);
        if (!queue) {
            queue = { items: [], running: false };
            queues.set(chatId, queue);
        }
        queue.items.push({ item, generation });
        pending++;
        if (!queue.running) scheduleChat(chatId);
        pump();
        return true;
    }

    // A reconnect starts a new processing generation. Pending work from the
    // previous socket is discarded, and in-flight workers receive isCurrent()
    // so callers can stop before performing further side effects.
    function invalidateAll() {
        generation++;
        let discarded = 0;
        for (const [chatId, queue] of queues) {
            discarded += queue.items.length;
            queue.items.length = 0;
            if (!queue.running) queues.delete(chatId);
        }
        pending = Math.max(0, pending - discarded);
        readyChats.length = 0;
        readySet.clear();
        return { generation, discarded };
    }

    return { enqueue, getStats, invalidateAll, isCurrent: token => isCurrent(token) };
}
