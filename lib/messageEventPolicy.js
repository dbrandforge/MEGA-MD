// Hard cap inbound message age at the agreed three-minute window. Environment
// overrides previously allowed stale messages to remain eligible for much longer.
const DEFAULT_MAX_AGE_MS = 180 * 1000;
const FUTURE_CLOCK_SKEW_MS = 60 * 1000;
// After a crash or redeploy WhatsApp redelivers messages the previous process
// had already answered. Anything sent before this process started is treated as
// a replay and ignored, so the bot never answers old messages mid-game.
// Inbound messages must have been sent after the latest successful WhatsApp
// connection. Rounding up to the next whole second avoids accepting a message
// sent just before the cutoff because WhatsApp timestamps have second precision.
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
 * Only process recent, decrypted messages with a stable key. Both live notify
 * arrivals and append/history events use the original WhatsApp message timestamp,
 * so reconnects and queue delays cannot make stale messages appear fresh.
 */
export function shouldProcessMessageUpsert(type, message, {
  now = Date.now(),
  maxAgeMs = DEFAULT_MAX_AGE_MS,
  startedAtMs = PROCESS_STARTED_AT
} = {}) {
  if (!message?.message || !message?.key?.remoteJid || !message?.key?.id) return false;
  if (message.message.senderKeyDistributionMessage) return false;
  if (message.message.protocolMessage && message.message.protocolMessage.type !== 0) return false;
  if (type !== 'notify' && type !== 'append') return false;
  if (type === 'append' && message.key.fromMe === true) return false;

  const age = getMessageAgeMs(message, now);
  if (age === null || age < -FUTURE_CLOCK_SKEW_MS || age > maxAgeMs) return false;
  if (message.key.fromMe === true) return true;
  const sentAt = now - age;
  return sentAt >= startedAtMs;
}
