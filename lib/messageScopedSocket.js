import { AsyncLocalStorage } from 'node:async_hooks';
import { isMessageRevoked, isMessageTooOld } from './messageEventPolicy.js';

const messageScope = new AsyncLocalStorage();
const wrappedSockets = new WeakSet();
const invalidatedSockets = new WeakSet();

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
        // Timers and async continuations can outlive the WhatsApp connection that
        // created them. Never let an old socket emit delayed replies after reconnect.
        if (invalidatedSockets.has(sock)) return undefined;
        const scope = messageScope.getStore();
        const source = scope?.sourceMessage;
        // Every send initiated inside an inbound-message handler belongs to that
        // source event, whether or not the plugin supplied quoted metadata. This
        // also covers delayed Gemini/API continuations and unquoted handler replies.
        // Independent scheduled jobs run outside this AsyncLocalStorage scope.
        // A continuation must never migrate from its originating socket to a
        // replacement socket through a global socket reference. This is the
        // reconnect edge that can otherwise let an old game callback reply using
        // the new live connection.
        if (scope && scope.sock !== sock) return undefined;
        if (scope && (isMessageRevoked(source) || isMessageTooOld(source))) return undefined;
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

/** Permanently fence outbound sends from a socket as soon as it closes. */
export function invalidateSocketMessageScope(sock) {
    if (!sock || typeof sock !== 'object') return false;
    invalidatedSockets.add(sock);
    return true;
}
