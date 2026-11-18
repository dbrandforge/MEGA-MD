const MEDIA_FIELDS = ['image', 'video', 'audio', 'document', 'sticker'];

function byteLength(value) {
    if (Buffer.isBuffer(value) || ArrayBuffer.isView(value)) return value.byteLength;
    if (value instanceof ArrayBuffer) return value.byteLength;
    return 0;
}

/**
 * Inspect only the top-level Baileys payload fields. Never read streams,
 * download URLs, stringify payloads, or retain message content.
 */
export function classifyOutboundPayload(content) {
    if (!content || typeof content !== 'object') {
        return { type: 'other', source: 'unknown', knownBytes: 0, textBytes: 0 };
    }

    for (const field of MEDIA_FIELDS) {
        const media = content[field];
        if (media === undefined || media === null) continue;

        let source = 'unknown';
        let knownBytes = byteLength(media);
        if (knownBytes > 0) {
            source = 'buffer';
        } else if (media && typeof media === 'object') {
            const dataBytes = byteLength(media.data);
            if (dataBytes > 0) {
                source = 'buffer';
                knownBytes = dataBytes;
            } else if (typeof media.url === 'string') {
                source = 'remote_url';
            } else if (media.stream) {
                source = 'stream';
            }
        } else if (typeof media === 'string') {
            source = 'remote_url';
        }

        return {
            type: field,
            source,
            knownBytes,
            textBytes: typeof content.caption === 'string' ? Buffer.byteLength(content.caption, 'utf8') : 0
        };
    }

    const text = typeof content.text === 'string' ? content.text : '';
    return {
        type: text ? 'text' : 'other',
        source: 'none',
        knownBytes: 0,
        textBytes: text ? Buffer.byteLength(text, 'utf8') : 0
    };
}

const TYPES = ['text', 'image', 'video', 'audio', 'document', 'sticker', 'other'];
const SOURCES = ['buffer', 'remote_url', 'stream', 'unknown', 'none'];

function emptyWindow() {
    return {
        sends: 0,
        failures: 0,
        totalDurationMs: 0,
        maxDurationMs: 0,
        knownMediaBytes: 0,
        textBytes: 0,
        types: Object.fromEntries(TYPES.map(type => [type, 0])),
        sources: Object.fromEntries(SOURCES.map(source => [source, 0]))
    };
}

/** Fixed-size aggregate counters. No IDs, JIDs, content, or per-message history. */
export function createOutboundMediaTelemetry() {
    let window = emptyWindow();

    return {
        record(summary, durationMs, failed = false) {
            const type = TYPES.includes(summary?.type) ? summary.type : 'other';
            const source = SOURCES.includes(summary?.source) ? summary.source : 'unknown';
            const duration = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0;

            window.sends += 1;
            if (failed) window.failures += 1;
            window.totalDurationMs += duration;
            if (duration > window.maxDurationMs) window.maxDurationMs = duration;
            window.types[type] += 1;
            window.sources[source] += 1;
            if (type !== 'text') window.knownMediaBytes += Number(summary?.knownBytes) || 0;
            window.textBytes += Number(summary?.textBytes) || 0;
        },

        drain() {
            const snapshot = window;
            window = emptyWindow();
            return snapshot;
        }
    };
}
