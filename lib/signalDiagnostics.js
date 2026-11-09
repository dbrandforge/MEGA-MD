// Prevent low-level libsignal diagnostics from exposing serialized ratchets or key material.
const SENSITIVE_SIGNAL_TEXT = [
    /Failed to decrypt message with any known session/i,
    /Bad MAC/i,
    /Decrypted message with closed session/i,
    /Removing old closed session/i,
    /Session error:/i,
    /\b(?:baseKey|remoteIdentityKey|ephemeralKeyPair|lastRemoteEphemeralKey|rootKey|chainKey|messageKeys|senderKey|signedIdentityKey|noiseKey|preKey|ratchet|ciphertext|macKey|privKey|privateKey|sessionRecord|currentRatchet|_chains|indexInfo)\b/i,
];

const SENSITIVE_SIGNAL_FIELD = /(?:baseKey|remoteIdentityKey|ephemeralKeyPair|lastRemoteEphemeralKey|rootKey|chainKey|messageKeys|senderKey|signedIdentityKey|noiseKey|preKey|ratchet|ciphertext|macKey|privKey|privateKey|sessionRecord|currentRatchet|_chains|indexInfo)/i;

function containsSensitiveSignalData(value, seen = new WeakSet()) {
    if (typeof value === 'string') return SENSITIVE_SIGNAL_TEXT.some(pattern => pattern.test(value));
    if (!value || typeof value !== 'object') return false;
    if (seen.has(value)) return false;
    seen.add(value);
    try {
        for (const [key, nested] of Object.entries(value)) {
            if (SENSITIVE_SIGNAL_FIELD.test(key) || containsSensitiveSignalData(nested, seen)) return true;
        }
        if (value instanceof Error) {
            return containsSensitiveSignalData(value.message, seen) ||
                containsSensitiveSignalData(value.stack || '', seen);
        }
    } catch {
        // Fail closed: an object that cannot be safely inspected is not logged.
        return true;
    }
    return false;
}

export function isSensitiveSignalDiagnostic(args) {
    return containsSensitiveSignalData(args);
}

export function installSignalDiagnosticGuard(targetConsole = console, originalMethods = null) {
    const originals = originalMethods || Object.fromEntries(
        ['log', 'info', 'debug', 'warn', 'error', 'dir', 'table', 'trace', 'assert'].map(method => [method, targetConsole[method].bind(targetConsole)])
    );
    const lastLoggedAt = new Map();
    for (const method of Object.keys(originals)) {
        targetConsole[method] = (...args) => {
            if (isSensitiveSignalDiagnostic(args)) {
                const category = args.some(value => typeof value === 'string' && /Bad MAC/i.test(value))
                    ? 'bad_mac'
                    : args.some(value => typeof value === 'string' && /decrypt/i.test(value))
                        ? 'decrypt_failed'
                        : 'sensitive_signal_diagnostic';
                const now = Date.now();
                if (now - (lastLoggedAt.get(category) || 0) >= 10000) {
                    lastLoggedAt.set(category, now);
                    originals[method]('[Signal] sensitive diagnostic suppressed; category=' + category);
                }
                return;
            }
            originals[method](...args);
        };
    }
    return () => {
        for (const method of Object.keys(originals)) targetConsole[method] = originals[method];
    };
}
