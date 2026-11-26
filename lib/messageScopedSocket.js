import { isMessageRevoked, isMessageTooOld } from './messageEventPolicy.js';

/**
 * Bind outbound replies to the inbound message that caused them.
 * Long-running handlers may finish after the original message has expired
 * or been revoked; those replies must not be sent later.
 */
export function createMessageScopedSocket(sock, sourceMessage) {
    if (!sock || typeof sock !== 'object') throw new TypeError('A socket is required');

    return new Proxy(sock, {
        get(target, property) {
            if (property === 'sendMessage') {
                return async (jid, ...args) => {
                    if (isMessageRevoked(sourceMessage) || isMessageTooOld(sourceMessage)) {
                        return undefined;
                    }
                    return target.sendMessage.call(target, jid, ...args);
                };
            }

            const value = Reflect.get(target, property, target);
            return typeof value === 'function' ? value.bind(target) : value;
        }
    });
}
