import { AsyncLocalStorage } from 'node:async_hooks';
import { isMessageRevoked, isMessageTooOld } from './messageEventPolicy.js';

const messageScope = new AsyncLocalStorage();
const wrappedSockets = new WeakSet();

/**
 * Install one transparent send guard per real socket, then scope each inbound
 * handler through AsyncLocalStorage. This preserves socket identity and keeps
 * concurrent chats isolated while suppressing replies after expiry/revocation.
 */
function ensureGuardedSocket(sock) {
    if (wrappedSockets.has(sock)) return;
    const originalSendMessage = sock.sendMessage;
    if (typeof originalSendMessage !== 'function') throw new TypeError('Socket sendMessage is required');

    sock.sendMessage = async function (jid, ...args) {
        const scope = messageScope.getStore();
        const options = args[1] || {};
        const source = scope?.sourceMessage;
        // Every send initiated inside an inbound-message handler belongs to that
        // source event, whether or not the plugin supplied quoted metadata. This
        // also covers delayed Gemini/API continuations and unquoted handler replies.
        // Independent scheduled jobs run outside this AsyncLocalStorage scope.
        if (scope?.sock === sock && (isMessageRevoked(source) || isMessageTooOld(source))) {
            return undefined;
        }
        return originalSendMessage.call(sock, jid, ...args);
    };
    wrappedSockets.add(sock);
}

export function runWithMessageScope(sock, sourceMessage, callback) {
    if (!sock || typeof sock !== 'object') throw new TypeError('A socket is required');
    if (typeof callback !== 'function') throw new TypeError('A callback is required');
    ensureGuardedSocket(sock);
    return messageScope.run({ sock, sourceMessage }, callback);
}
