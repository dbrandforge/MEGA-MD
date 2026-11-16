import net from 'net';

const INSTALL_MARKER = Symbol.for('forge.networkDiagnostics.installed');
const MAX_DESTINATIONS = 24;
const PRIVATE_IPV4 = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/;
const PRIVATE_IPV6 = /^(::1|fc[0-9a-f]{2}:|fd[0-9a-f]{2}:|fe80:)/i;

function normalizeHost(value = '') {
    return String(value)
        .trim()
        .toLowerCase()
        .replace(/^\[|\]$/g, '')
        .replace(/\.$/, '');
}

export function classifyNetworkDestination({ hostname = '', remoteAddress = '', port = 0 } = {}) {
    const host = normalizeHost(hostname);
    const address = normalizeHost(remoteAddress);
    const numericPort = Number(port) || 0;

    if (address === '::1' || address === '127.0.0.1' ||
        PRIVATE_IPV4.test(address) || PRIVATE_IPV6.test(address) ||
        address.startsWith('::ffff:127.') || address.startsWith('::ffff:10.') ||
        address.startsWith('::ffff:192.168.')) {
        return 'private_or_local';
    }

    if (/mongodb\.(net|com)$/.test(host) || /(^|\.)mongodb\./.test(host) ||
        [27017, 27018, 27019].includes(numericPort)) return 'mongodb';

    if (/whatsapp\.(net|com)$/.test(host) || /(^|\.)whatsapp\./.test(host) ||
        /wa\.me$/.test(host)) return 'whatsapp';

    if (/generativelanguage\.googleapis\.com$/.test(host) ||
        /(^|\.)googleapis\.com$/.test(host)) return 'google_ai';

    if (/(^|\.)groq\.com$/.test(host)) return 'groq_ai';
    if (/(^|\.)openai\.com$/.test(host)) return 'openai_ai';

    if (/(^|\.)(youtube\.com|googlevideo\.com|ytimg\.com|giphy\.com|tenor\.com|cloudinary\.com|imgur\.com)$/.test(host) ||
        /(^|\.)fbcdn\.net$/.test(host)) return 'media_cdn';

    if (host) {
        const labels = host.split('.').filter(Boolean);
        const secondLevelSuffixes = new Set(['co.uk', 'com.au', 'co.nz', 'com.br', 'co.jp', 'co.in', 'com.ng', 'com.sg']);
        const suffix = labels.slice(-2).join('.');
        const safeDomain = secondLevelSuffixes.has(suffix) && labels.length >= 3
            ? labels.slice(-3).join('.')
            : (labels.length >= 2 ? suffix : labels[0]);
        return `external:${safeDomain.slice(0, 80)}`;
    }

    if (address && !address.includes(':') && /^\d{1,3}(\.\d{1,3}){3}$/.test(address)) {
        return `external_ip:port-${numericPort || 'unknown'}`;
    }
    return `external:port-${numericPort || 'unknown'}`;
}

function byteLength(chunk, encoding) {
    if (typeof chunk === 'string') return Buffer.byteLength(chunk, typeof encoding === 'string' ? encoding : 'utf8');
    if (Buffer.isBuffer(chunk) || chunk instanceof Uint8Array) return chunk.byteLength;
    return 0;
}

export function createEgressWindow() {
    const destinations = new Map();

    return {
        record(destination, bytes, socket) {
            if (!bytes || bytes < 0 || destination === 'private_or_local') return;
            let entry = destinations.get(destination);
            if (!entry) {
                if (destinations.size >= MAX_DESTINATIONS) destination = 'other_destinations';
                entry = destinations.get(destination);
            }
            if (!entry) {
                entry = { bytes: 0, writes: 0, sockets: new Set() };
                destinations.set(destination, entry);
            }
            entry.bytes += bytes;
            entry.writes++;
            if (socket) entry.sockets.add(socket);
        },
        snapshot() {
            const breakdown = [...destinations.entries()]
                .map(([destination, entry]) => ({
                    destination,
                    bytes: entry.bytes,
                    mib: Number((entry.bytes / 1024 / 1024).toFixed(3)),
                    writes: entry.writes,
                    sockets: entry.sockets.size,
                }))
                .sort((a, b) => b.bytes - a.bytes);
            const totalBytes = breakdown.reduce((sum, entry) => sum + entry.bytes, 0);
            return {
                totalBytes,
                totalMiB: Number((totalBytes / 1024 / 1024).toFixed(3)),
                breakdown,
            };
        },
        clear() {
            destinations.clear();
        },
    };
}

function isOutboundSocket(socket, outboundSockets) {
    if (outboundSockets.has(socket)) return true;
    // TLS wraps the TCP socket; retain the original outbound marker through
    // Node's parent reference without inspecting request or credential data.
    return !!(socket?._parent && outboundSockets.has(socket._parent));
}

function getSocketDestination(socket) {
    const parent = socket?._parent;
    return classifyNetworkDestination({
        hostname: socket?.servername || socket?._host || parent?._host || '',
        remoteAddress: socket?.remoteAddress || parent?.remoteAddress || '',
        port: socket?.remotePort || parent?.remotePort || 0,
    });
}

/**
 * Count application payload bytes written to outbound TCP/TLS sockets.
 * This deliberately records no payload contents, URLs, headers, JIDs, or secrets.
 * The measurement is socket-write payload size, so Render's platform-level
 * egress can be slightly higher due to TLS framing, TCP/IP headers and retransmits.
 */
export function installNetworkDiagnostics({
    enabled = process.env.NETWORK_DIAGNOSTICS !== 'false' && process.env.NODE_ENV !== 'test',
    intervalMs = 60_000,
    log = line => console.log(line),
} = {}) {
    if (!enabled || net.Socket.prototype[INSTALL_MARKER]) return false;

    const outboundSockets = new WeakSet();
    const window = createEgressWindow();
    const startedAt = Date.now();
    let windowStartedAt = startedAt;

    const originalConnect = net.Socket.prototype.connect;
    const originalWrite = net.Socket.prototype.write;

    net.Socket.prototype.connect = function (...args) {
        outboundSockets.add(this);
        return originalConnect.apply(this, args);
    };

    net.Socket.prototype.write = function (chunk, encoding, callback) {
        const result = originalWrite.call(this, chunk, encoding, callback);
        if (isOutboundSocket(this, outboundSockets)) {
            const bytes = byteLength(chunk, encoding);
            if (bytes) window.record(getSocketDestination(this), bytes, this);
        }
        return result;
    };

    Object.defineProperty(net.Socket.prototype, INSTALL_MARKER, {
        value: true,
        configurable: false,
        enumerable: false,
        writable: false,
    });

    const timer = setInterval(() => {
        const endedAt = Date.now();
        const snapshot = window.snapshot();
        if (snapshot.totalBytes > 0) {
            log(`[network-egress] ${JSON.stringify({
                measurement: 'outbound_tcp_socket_write_payload',
                windowStart: new Date(windowStartedAt).toISOString(),
                windowEnd: new Date(endedAt).toISOString(),
                durationSeconds: Number(((endedAt - windowStartedAt) / 1000).toFixed(1)),
                ...snapshot,
            })}`);
        }
        window.clear();
        windowStartedAt = endedAt;
    }, intervalMs);

    if (typeof timer.unref === 'function') timer.unref();
    log(`[network-egress] diagnostics enabled interval_seconds=${Math.round(intervalMs / 1000)}; payloads and request contents are never logged`);
    return true;
}
