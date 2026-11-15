const DEFAULT_APPEND_MAX_AGE_MS = 5 * 60 * 1000;
const FUTURE_CLOCK_SKEW_MS = 60 * 1000;

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

/**
 * Baileys 'notify' events are live arrivals. 'append' may contain history-sync
 * records, so only process recent, decrypted, inbound messages with a stable key.
 * This prevents replaying old commands after reconnect while recovering messages
 * delivered during a short disconnect.
 */
export function shouldProcessMessageUpsert(type, message, {
  now = Date.now(),
  appendMaxAgeMs = DEFAULT_APPEND_MAX_AGE_MS
} = {}) {
  if (!message?.message || !message?.key?.remoteJid || !message?.key?.id) return false;
  // Sender-key distribution messages are WhatsApp transport/key-management
  // traffic, not user messages. Running the full command/game/chatbot pipeline
  // for each one wastes CPU and adds latency to real messages.
  if (message.message.senderKeyDistributionMessage) return false;
  // Preserve message revocations (type 0); ignore other protocol-only updates.
  if (message.message.protocolMessage && message.message.protocolMessage.type !== 0) return false;
  if (type === 'notify') return true;
  if (type !== 'append' || message.key.fromMe === true) return false;

  const timestamp = toTimestampMs(message.messageTimestamp);
  if (!Number.isFinite(timestamp)) return false;
  const age = now - timestamp;
  return age >= -FUTURE_CLOCK_SKEW_MS && age <= appendMaxAgeMs;
}
