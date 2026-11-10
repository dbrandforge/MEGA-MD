/**
 * Group chatbot replies only when the bot is directly addressed or the user
 * replies to a message authored by the bot. Replies to other participants,
 * game prompts, and ordinary group messages remain outside the chatbot.
 */
function jidIdentity(value = '') {
  return String(value).split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

export function isExplicitlyAddressedInGroup({ isMention = false, isReplyToBot = false, quotedParticipant = '', botJids = [] } = {}) {
  if (isMention || isReplyToBot) return true;
  if (!quotedParticipant || !Array.isArray(botJids) || !botJids.length) return false;
  const quotedIdentity = jidIdentity(quotedParticipant);
  return Boolean(quotedIdentity && botJids.some(jid => jidIdentity(jid) === quotedIdentity));
}


// A follow-up is active only while this participant's own transcript has a recent bot reply.
export function hasActiveGroupFollowup(history, now = Date.now(), windowMs = 10 * 60 * 1000) {
  if (!Array.isArray(history) || !Number.isFinite(now) || !Number.isFinite(windowMs) || windowMs <= 0) return false;
  const lastBotReply = [...history].reverse().find(item =>
    item && item.name === 'Forge Bot' && typeof item.at === 'number'
  );
  if (!lastBotReply) return false;
  const age = now - lastBotReply.at;
  return age >= 0 && age <= windowMs;
}


function canonicalJid(value = '') {
  const raw = String(value || '').trim();
  if (!raw.includes('@')) return raw.split(':')[0];
  const [user, server] = raw.split('@');
  return `${user.split(':')[0]}@${server}`;
}

async function jidAliases(value, sock) {
  const jid = canonicalJid(value);
  if (!jid) return new Set();
  const aliases = new Set([jid]);
  try {
    if (jid.endsWith('@lid')) {
      const pn = await sock?.signalRepository?.lidMapping?.getPNForLID?.(jid);
      if (pn) aliases.add(canonicalJid(pn));
    } else if (jid.endsWith('@s.whatsapp.net')) {
      const lid = await sock?.signalRepository?.lidMapping?.getLIDForPN?.(jid);
      if (lid) aliases.add(canonicalJid(lid));
    }
  } catch {
    // Direct JID equality remains available if the optional mapping lookup fails.
  }
  return aliases;
}

export async function jidMatchesAnyBotIdentity(candidate, botJids = [], sock) {
  if (!candidate || !Array.isArray(botJids) || !botJids.length) return false;
  const candidateAliases = await jidAliases(candidate, sock);
  for (const botJid of botJids) {
    const botAliases = await jidAliases(botJid, sock);
    if ([...candidateAliases].some(alias => botAliases.has(alias))) return true;
  }
  return false;
}

export function isBotNameTrigger(text = '') {
  return /^(?:@?bota|@?bot)(?=$|[\\s,:.!?])/i.test(String(text || '').trim());
}
