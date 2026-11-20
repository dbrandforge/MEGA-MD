const configuredMaxAgeSeconds = Number(process.env.MESSAGE_MAX_AGE_SECONDS);
const DEFAULT_MAX_AGE_MS = Number.isFinite(configuredMaxAgeSeconds) && configuredMaxAgeSeconds > 0
  ? Math.min(configuredMaxAgeSeconds, 3600) * 1000
  : 180 * 1000;
const FUTURE_CLOCK_SKEW_MS = 60 * 1000;

function toTimestampMs(value) {
  if (value && typeof value === 'object' && typeof value.toNumber === 'function') {
    value = value.toNumber();
  }
  if (typeof value === 'bigint') value = Number(value);
  if (typeof value === 'string' && !/^\\d+(?:\\.\\d+)?$/.test(value)) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return NaN;
  return numeric >= 1e12 ? numeric : numeric * 1000;
}

export function getMessageAgeMs(message, now = Date.now()) {
  const timestamp = toTimestampMs(message?.messageTimestamp);
  return Number.isFinite(timestamp) ? now - timestamp : null;
}

export function isMessageTooOld(message, now = Date.now(), maxAgeMs = DEFAULT_MAX_AGE_MS) {
  const age = getMessageAgeMs(message, now);
  return age !== null && age > maxAgeMs;
}

/**
 * Only process recent, decrypted messages with a stable key. Both live notify
 * arrivals and append/history events use the original WhatsApp message timestamp,
 * so reconnects and queue delays cannot make stale messages appear fresh.
 */
export function shouldProcessMessageUpsert(type, message, {
  now = Date.now(),
  maxAgeMs = DEFAULT_MAX_AGE_MS
} = {}) {
  if (!message?.message || !message?.key?.remoteJid || !message?.key?.id) return false;
  if (message.message.senderKeyDistributionMessage) return false;
  if (message.message.protocolMessage && message.message.protocolMessage.type !== 0) return false;
  if (type !== 'notify' && type !== 'append') return false;
  if (type === 'append' && message.key.fromMe === true) return false;

  const age = getMessageAgeMs(message, now);
  return age !== null && age >= -FUTURE_CLOCK_SKEW_MS && age <= maxAgeMs;
}
