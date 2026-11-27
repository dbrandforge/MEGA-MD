// Hard cap inbound message age at 30 seconds. Delayed deliveries and queue congestion
// must not turn old messages into executable commands.
const DEFAULT_MAX_AGE_MS = 30 * 1000;
const FUTURE_CLOCK_SKEW_MS = 10 * 1000;
// Only Baileys "notify" events represent live inbound messages. "append" events
// are history-sync/replay deliveries and must never reach command or chatbot
// handling, even when their timestamps appear recent. The connection cutoff
// additionally rejects notifications sent before the current live connection.
let PROCESS_STARTED_AT = Math.ceil(Date.now() / 1000) * 1000;

const REVOKED_MESSAGE_TTL_MS = 10 * 60 * 1000;
const MAX_REVOKED_MESSAGE_IDS = 10000;
const revokedMessages = new Map();

export function markMessageRevoked(chatId, messageId, now = Date.now()) {
  if (!chatId || !messageId) return false;
  const key = String(chatId) + ':' + String(messageId);
  revokedMessages.delete(key);
  revokedMessages.set(key, now + REVOKED_MESSAGE_TTL_MS);
  while (revokedMessages.size > MAX_REVOKED_MESSAGE_IDS) {
    revokedMessages.delete(revokedMessages.keys().next().value);
  }
  return true;
}

export function isMessageRevoked(message, now = Date.now()) {
  const chatId = message?.key?.remoteJid;
  const messageId = message?.key?.id;
  if (!chatId || !messageId) return false;
  const key = String(chatId) + ':' + String(messageId);
  const expiresAt = revokedMessages.get(key);
  if (!expiresAt) return false;
  if (expiresAt <= now) {
    revokedMessages.delete(key);
    return false;
  }
  return true;
}

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
 * Process only live notify deliveries. History-sync append events are rejected
 * unconditionally so reconnects and history replay cannot trigger old replies.
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
  // Apply the live-connection cutoff to every message, including fromMe.
  // Self-originated notify events are not exempt: delayed echoes must never
  // re-enter command/game handling after a reconnect.
  const sentAt = now - age;
  return sentAt >= startedAtMs;
}
