// Prevent low-level libsignal diagnostics from exposing serialized ratchets or key material.
const SENSITIVE_SIGNAL_TEXT = [
    /Failed to decrypt message with any known session/i,
    /Bad MAC/i,
    /Decrypted message with closed session/i,
    /Removing old closed session/i,
    /Closing stale open session/i,
    /No session found/i,
    /Invalid PreKey/i,
    /PreKeyError/i,
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

// Classify only the error text needed for triage; never return or log raw diagnostics.
export function classifySignalDiagnostic(args) {
    const texts = [];
    const seen = new WeakSet();
    const collect = value => {
        if (typeof value === 'string') { texts.push(value); return; }
        if (!value || typeof value !== 'object' || seen.has(value)) return;
        seen.add(value);
        if (value instanceof Error) texts.push(value.message || '');
        try { for (const nested of Object.values(value)) collect(nested); } catch {}
    };
    collect(args);
    const text = texts.join('\\n');
    if (/Bad MAC/i.test(text)) return 'bad_mac';
    if (/Failed to decrypt|decrypt(?:ion)? failed/i.test(text)) return 'decrypt_failed';
    if (/Closing stale open session|closed session/i.test(text)) return 'closed_session';
    if (/No session found|no session/i.test(text)) return 'no_session';
    if (/Invalid PreKey|pre.?key/i.test(text)) return 'prekey_failure';
    if (/Session error/i.test(text)) return 'session_error';
    return 'sensitive_signal_diagnostic';
}

export function installSignalDiagnosticGuard(targetConsole = console, originalMethods = null) {
    const originals = originalMethods || Object.fromEntries(
        ['log', 'info', 'debug', 'warn', 'error', 'dir', 'table', 'trace', 'assert'].map(method => [method, targetConsole[method].bind(targetConsole)])
    );
    const lastLoggedAt = new Map();
    for (const method of Object.keys(originals)) {
        targetConsole[method] = (...args) => {
            if (isSensitiveSignalDiagnostic(args)) {
                const category = classifySignalDiagnostic(args);
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
