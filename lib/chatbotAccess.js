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
