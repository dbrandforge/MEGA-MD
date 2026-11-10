export function isMemberAlreadyActive(prior) {
  return prior?.everJoined === true && prior?.status === 'active';
}

export function buildWelcomeBatchMessage(participants, template) {
  const mentions = [...new Set((participants || []).filter(id => typeof id === 'string' && id.length))];
  const mentionText = mentions.map(id => `@${id.split('@')[0]}`).join(', ');
  const text = String(template || '')
    .replace(/@user/g, mentionText)
    .replace(/\{user\}/g, mentionText);
  return { text, mentions };
}

export function mergeWelcomeParticipants(existing = [], incoming = []) {
  const merged = new Map();
  for (const participant of [...existing, ...incoming]) {
    const id = typeof participant === 'string'
      ? participant
      : (participant?.id || participant?.phoneNumber || participant?.lid);
    if (id) merged.set(id, participant);
  }
  return [...merged.values()];
}
