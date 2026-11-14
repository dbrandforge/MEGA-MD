import store from './lightweight_store.js';

const PRESENCE_KEY = 'forgeGuardGroupPresence';

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
export async function verifyGroupPresence(sock, chatId) {
  if (!chatId?.endsWith('@g.us')) return { status: 'not-group', present: false };
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
    if (!present) {
      console.warn(`[GROUP PRESENCE] Bot is no longer a participant in ${metadata?.subject || chatId}; group automations are paused.`);
    }
    return record;
  } catch (error) {
    const denied = isAccessDenied(error);
    if (denied) {
      const record = { status: 'unknown', present: false, checkedAt: Date.now(), reason: 'metadata-access-denied' };
      await store.saveSettingVerified(chatId, PRESENCE_KEY, record);
      console.warn(`[GROUP PRESENCE] Could not verify membership for ${chatId} (WhatsApp denied metadata access); group automations are paused until membership can be verified.`);
    }
    return { status: 'unknown', present: false, reason: error?.message || 'metadata-check-failed' };
  }
}

export async function isGroupPresenceActive(sock, chatId) {
  const result = await verifyGroupPresence(sock, chatId);
  return result.status === 'active' && result.present === true;
}
