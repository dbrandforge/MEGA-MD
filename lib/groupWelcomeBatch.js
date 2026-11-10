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
