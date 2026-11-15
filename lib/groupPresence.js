import store from './lightweight_store.js';

const PRESENCE_KEY = 'forgeGuardGroupPresence';
const CACHE_TTL_MS = 2 * 60 * 1000;
const UNKNOWN_CACHE_TTL_MS = 30 * 1000;
const presenceCache = new Map();

function normalizeJid(value) {
  let jid = String(value || '').trim().replace(/:\\d+(?=@)/, '').toLowerCase();
  if (jid.endsWith('@c.us')) jid = jid.slice(0, -'@c.us'.length) + '@s.whatsapp.net';
  return jid;
}

function participantIdentityValues(participant) {
  if (typeof participant === 'string') return [participant];
  if (!participant || typeof participant !== 'object') return [];
  return [
    participant.id,
    participant.jid,
    participant.phoneNumber,
    participant.lid,
    participant.phoneNumberJid
  ].filter(value => typeof value === 'string' && value.length > 0);
}

async function addMappedIdentityAliases(sock, values, identities) {
  const mapping = sock?.signalRepository?.lidMapping;
  for (const value of values) {
    const jid = normalizeJid(value);
    if (!jid) continue;
    identities.add(jid);
    try {
      if (jid.endsWith('@lid') && typeof mapping?.getPNForLID === 'function') {
        const pn = await mapping.getPNForLID(jid);
        if (pn) identities.add(normalizeJid(pn));
      } else if (jid.endsWith('@s.whatsapp.net') && typeof mapping?.getLIDForPN === 'function') {
        const lid = await mapping.getLIDForPN(jid);
        if (lid) identities.add(normalizeJid(lid));
      }
    } catch {
      // Direct participant aliases remain usable when the local LID map is unavailable.
    }
  }
}

function isAccessDenied(error) {
  const status = Number(error?.data?.statusCode ?? error?.statusCode ?? error?.output?.statusCode);
  return status === 403 || status === 404 || /forbidden|not-authorized|not-authorised/i.test(String(error?.message || ''));
}

/**
 * Verifies actual membership using every WhatsApp identity exposed for the bot
 * and each participant. Baileys v7 can represent the same account as PN or LID;
 * preferring participant.id alone produces false "bot absent" results.
 *
 * Metadata errors and incomplete metadata remain unknown, never proof of removal.
 */
export async function verifyGroupPresence(sock, chatId, { force = false } = {}) {
  if (!chatId?.endsWith('@g.us')) return { status: 'not-group', present: false };
  const cached = presenceCache.get(chatId);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.result;

  const botValues = [
    sock?.user?.id,
    sock?.user?.jid,
    sock?.user?.phoneNumber,
    sock?.user?.lid,
    sock?.user?.lidJid
  ].filter(value => typeof value === 'string' && value.length > 0);
  if (!botValues.length) return { status: 'unknown', present: false, reason: 'bot-jid-unavailable' };

  try {
    const metadata = await sock.groupMetadata(chatId);
    if (!Array.isArray(metadata?.participants)) {
      const result = { status: 'unknown', present: false, reason: 'participant-list-unavailable' };
      presenceCache.set(chatId, { result, expiresAt: Date.now() + UNKNOWN_CACHE_TTL_MS });
      return result;
    }

    const botIdentities = new Set();
    await addMappedIdentityAliases(sock, botValues, botIdentities);

    let present = false;
    for (const participant of metadata.participants) {
      const participantIdentities = new Set(participantIdentityValues(participant).map(normalizeJid).filter(Boolean));
      if ([...participantIdentities].some(identity => botIdentities.has(identity))) {
        present = true;
        break;
      }

      // Resolve participant LID/PN aliases only when direct fields did not match.
      await addMappedIdentityAliases(sock, participantIdentityValues(participant), participantIdentities);
      if ([...participantIdentities].some(identity => botIdentities.has(identity))) {
        present = true;
        break;
      }
    }

    const record = {
      status: present ? 'active' : 'absent',
      present,
      checkedAt: Date.now(),
      groupName: metadata?.subject || null
    };
    await store.saveSettingVerified(chatId, PRESENCE_KEY, record);
    presenceCache.set(chatId, { result: { ...record }, expiresAt: Date.now() + CACHE_TTL_MS });
    if (!present) {
      console.warn(`[GROUP PRESENCE] WhatsApp returned a complete participant list without the bot identity for ${metadata?.subject || chatId}; group setup remains paused pending confirmation.`);
    }
    return record;
  } catch (error) {
    const result = {
      status: 'unknown',
      present: false,
      reason: isAccessDenied(error) ? 'metadata-access-denied' : (error?.message || 'metadata-check-failed')
    };
    if (isAccessDenied(error)) {
      await store.saveSettingVerified(chatId, PRESENCE_KEY, {
        status: 'unknown',
        present: false,
        checkedAt: Date.now(),
        reason: result.reason
      });
      console.warn(`[GROUP PRESENCE] WhatsApp denied metadata access for ${chatId}; membership remains unknown and setup is paused.`);
    }
    presenceCache.set(chatId, { result, expiresAt: Date.now() + UNKNOWN_CACHE_TTL_MS });
    return result;
  }
}

export async function isGroupPresenceActive(sock, chatId) {
  const result = await verifyGroupPresence(sock, chatId, { force: true });
  return result.status === 'active' && result.present === true;
}
