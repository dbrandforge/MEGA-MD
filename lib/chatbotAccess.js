/**
 * In group chats the chatbot is opt-in per message: only an explicit @mention
 * starts a response. A reply to a game prompt is not a chatbot invitation.
 */
export function isExplicitlyAddressedInGroup({ isMention = false } = {}) {
  return Boolean(isMention);
}
