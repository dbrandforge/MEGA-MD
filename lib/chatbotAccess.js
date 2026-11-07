export function isExplicitlyAddressedInGroup({ isMention = false, isReply = false } = {}) {
  return Boolean(isMention || isReply);
}
