// Hard cap inbound message age at the agreed three-minute window. Environment
// overrides previously allowed stale messages to remain eligible for much longer.
const DEFAULT_MAX_AGE_MS = 180 * 1000;
const FUTURE_CLOCK_SKEW_MS = 60 * 1000;
// After a crash, reconnect or redeploy, WhatsApp may replay recent history as
// "append" events. Only "notify" represents a live inbound delivery. The cutoff
// is reset on every successful connection so messages delivered before the
// socket became live cannot be processed after reconnect.
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
 * Process only recent, decrypted live notifications with a stable key.
 * History/replay ("append") events are always rejected, even when their
 * original timestamps fall inside the three-minute live-message window.
 */
export function shouldProcessMessageUpsert(type, message, {
  now = Date.now(),
  maxAgeMs = DEFAULT_MAX_AGE_MS,
  startedAtMs = PROCESS_STARTED_AT
} = {}) {
  if (type !== 'notify') return false;
  if (!message?.message || !message?.key?.remoteJid || !message?.key?.id) return false;
  if (message.message.senderKeyDistributionMessage) return false;
  if (message.message.protocolMessage && message.message.protocolMessage.type !== 0) return false;

  const age = getMessageAgeMs(message, now);
  if (age === null || age < -FUTURE_CLOCK_SKEW_MS || age > maxAgeMs) return false;
  if (message.key.fromMe === true) return true;
  const sentAt = now - age;
  return sentAt >= startedAtMs;
}
