/**
 * Group chatbot access and contextual follow-up detection.
 * A recent bot reply is necessary but not sufficient: the next message must
 * contain clear linguistic evidence that it continues the bot's last answer.
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

function isCasualGreeting(text) {
  return /^(?:hey|hi|hello|yo|guy|my guy|bro|oga|boss)?\s*(?:how far|how you dey|wetin dey|what'?s popping|what'?s good|what'?s happening|how body|you good|how are you)\b[!.?\s]*$/i.test(text)
    || /^(?:my guy|guy|bro|oga|boss)[,\s]+(?:how far|how you dey|what'?s popping)\b/i.test(text);
}

/**
 * Conservative language-level intent gate. It deliberately favours silence
 * over guessing: standalone questions/topics need an explicit mention/reply.
 */
export function hasContextualFollowupIntent(candidateText = '') {
  const text = String(candidateText || '').trim().replace(/\s+/g, ' ');
  if (!text || isCasualGreeting(text)) return false;

  const directContinuations = [
    /^(?:and\s+)?(?:what about|how about)\b/i,
    /^(?:can you|could you|please)\s+(?:explain|clarify|simplify|expand|elaborate|repeat|rephrase)\b/i,
    /^(?:explain|clarify|simplify|expand|elaborate|rephrase)\s+(?:that|it|this|the same)\b/i,
    /^(?:make|put)\s+(?:that|it|this)\s+(?:simpler|more simply|in simple terms|another way)\b/i,
    /^(?:give|show|provide)\s+(?:me\s+)?(?:(?:another|more)\s+|an?\s+)?(?:example|examples|details|steps|context)\b/i,
    /^(?:another|more)\s+(?:example|examples|details|information|context|one)\b/i,
    /^(?:why is that|how so|what do you mean|what does that mean|who are they|which ones|what are those)\b/i,
    /^(?:so\s+)?(?:does|do|is|are|was|were|can|could|would|will|did)\s+(?:it|that|this|they|them|those|these)\b/i,
    /^(?:what|which|where|when|who|how)\s+(?:else|next)\b/i,
    /^(?:example|examples|process(?:es)? involved|steps involved|advantages|disadvantages|benefits|types|causes|effects)\b/i,
    /^(?:wetin you mean|wetin that mean|how e take happen|how e be|explain am|break am down|give me example|another example|so e mean say)\b/i,
    /^(?:ṣàlàyé|kí ló túmọ̀ sí|kí ni ìyẹn túmọ̀ sí|àpẹẹrẹ|ẹ jọ̀ọ́ ṣàlàyé)(?:$|\s)/i
  ];
  return directContinuations.some(pattern => pattern.test(text));
}

// A follow-up is active only if this participant has a recent bot reply AND
// the incoming text clearly depends on that reply. The caller supplies the
// participant-isolated transcript, so other members cannot inherit the turn.
export function hasActiveGroupFollowup(history, now = Date.now(), windowMs = 10 * 60 * 1000, candidateText = '') {
  if (!Array.isArray(history) || !Number.isFinite(now) || !Number.isFinite(windowMs) || windowMs <= 0) return false;
  if (!hasContextualFollowupIntent(candidateText)) return false;
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
  return /^(?:@?bota|@?bot)(?=$|[\s,:.!?])/i.test(String(text || '').trim());
}

export function stripBotNameTrigger(text = '') {
  const value = String(text || '').trim();
  if (!isBotNameTrigger(value)) return value;
  const remainder = value.replace(/^@?bota?\b[,:.!?\s-]*/i, '').trim();
  return remainder || 'hello';
}
