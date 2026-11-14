import store from './lightweight_store.js';

const PRESENCE_KEY = 'forgeGuardGroupPresence';
const CACHE_TTL_MS = 2 * 60 * 1000;
const presenceCache = new Map();

function normalizeJid(value) {
  return String(value || '').replace(/:\d+(?=@)/, '').toLowerCase();
}

function isAccessDenied(error) {
  const status = Number(error?.data?.statusCode ?? error?.statusCode ?? error?.output?.statusCode);
  return status === 403 || status === 404 || /forbidden|not-authorized|not-authorised/i.test(String(error?.message || ''));
}

/**
 * Verifies actual membership from WhatsApp group metadata.
 * A successful metadata response without the bot in participants is definitive.
 * Metadata failures are treated as unknown (fail closed by callers), not as proof
 * that the bot was removed; this avoids confusing temporary API/admin errors with removal.
 */
export async function verifyGroupPresence(sock, chatId, { force = false } = {}) {
  if (!chatId?.endsWith('@g.us')) return { status: 'not-group', present: false };
  const cached = presenceCache.get(chatId);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.result;
  const botJid = normalizeJid(sock?.user?.id || sock?.user?.jid);
  if (!botJid) return { status: 'unknown', present: false, reason: 'bot-jid-unavailable' };

  try {
    const metadata = await sock.groupMetadata(chatId);
    const participants = Array.isArray(metadata?.participants) ? metadata.participants : [];
    const present = participants.some(participant =>
      normalizeJid(participant?.id || participant?.jid || participant?.phoneNumber) === botJid
    );
    const record = {
      status: present ? 'active' : 'absent',
      present,
      checkedAt: Date.now(),
      groupName: metadata?.subject || null
    };
    await store.saveSettingVerified(chatId, PRESENCE_KEY, record);
    const result = { ...record };
    presenceCache.set(chatId, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    if (!present) {
      console.warn(`[GROUP PRESENCE] Bot is no longer a participant in ${metadata?.subject || chatId}; group automations are paused.`);
    }
    return record;
  } catch (error) {
    const denied = isAccessDenied(error);
    if (denied) {
      const record = { status: 'unknown', present: false, checkedAt: Date.now(), reason: 'metadata-access-denied' };
      await store.saveSettingVerified(chatId, PRESENCE_KEY, record);
      presenceCache.set(chatId, { result: { ...record }, expiresAt: Date.now() + 30_000 });
      console.warn(`[GROUP PRESENCE] Could not verify membership for ${chatId} (WhatsApp denied metadata access); group automations are paused until membership can be verified.`);
    }
    const result = { status: 'unknown', present: false, reason: error?.message || 'metadata-check-failed' };
    presenceCache.set(chatId, { result, expiresAt: Date.now() + 30_000 });
    return result;
  }
}

export async function isGroupPresenceActive(sock, chatId) {
  const result = await verifyGroupPresence(sock, chatId, { force: true });
  return result.status === 'active' && result.present === true;
}
