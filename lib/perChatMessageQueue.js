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

    function getStats() {
        return {
            active,
            pending,
            chats: queues.size,
            maxConcurrentChats
        };
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

            const item = queue.items.shift();
            pending--;
            queue.running = true;
            active++;

            Promise.resolve()
                .then(() => processMessage(item, chatId))
                .catch(error => {
                    try { onError(error, item, chatId); } catch {}
                })
                .finally(() => {
                    active--;
                    queue.running = false;
                    if (queue.items.length) scheduleChat(chatId);
                    else queues.delete(chatId);
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
        queue.items.push(item);
        pending++;
        if (!queue.running) scheduleChat(chatId);
        pump();
        return true;
    }

    return { enqueue, getStats };
}
