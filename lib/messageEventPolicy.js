// Hard cap inbound message age at the agreed three-minute window. Environment
// overrides previously allowed stale messages to remain eligible for much longer.
const DEFAULT_MAX_AGE_MS = 180 * 1000;
const FUTURE_CLOCK_SKEW_MS = 60 * 1000;
// After a crash, reconnect or redeploy, WhatsApp may replay recent history as
// "append" events. Accept append only while the original message timestamp is
// inside the same strict three-minute window and after the live-connection
// cutoff. This permits recent messages delivered as append without processing
// older history. The cutoff is reset on every successful connection.
let PROCESS_STARTED_AT = Math.ceil(Date.now() / 1000) * 1000;

export function setMessageProcessingCutoff(timestamp = Date.now()) {
  const numeric = Number(timestamp);
  if (!Number.isFinite(numeric) || numeric <= 0) throw new TypeError('A valid cutoff timestamp is required');
  PROCESS_STARTED_AT = Math.ceil(numeric / 1000) * 1000;
  return PROCESS_STARTED_AT;
}

function toTimestampMs(value) {
  if (value && typeof value === 'object' && typeof value.toNumber === 'function') {
    value = value.toNumber();
  }
  if (typeof value === 'bigint') value = Number(value);
  if (typeof value === 'string' && !/^\d+(?:\.\d+)?$/.test(value)) {
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
 * Accept recent notify and append deliveries, but apply identical timestamp,
 * connection-cutoff, payload and stable-key checks to both. Append messages
 * authored by this bot are rejected to prevent self-replies.
 */
export function shouldProcessMessageUpsert(type, message, {
  now = Date.now(),
  maxAgeMs = DEFAULT_MAX_AGE_MS,
  startedAtMs = PROCESS_STARTED_AT
} = {}) {
  if (type !== 'notify' && type !== 'append') return false;
  if (!message?.message || !message?.key?.remoteJid || !message?.key?.id) return false;
  if (message.message.senderKeyDistributionMessage) return false;
  if (message.message.protocolMessage && message.message.protocolMessage.type !== 0) return false;
  if (type === 'append' && message.key.fromMe === true) return false;

  const age = getMessageAgeMs(message, now);
  if (age === null || age < -FUTURE_CLOCK_SKEW_MS || age > maxAgeMs) return false;
  if (message.key.fromMe === true) return true;
  const sentAt = now - age;
  return sentAt >= startedAtMs;
}
