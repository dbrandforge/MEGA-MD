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


export function createOrExtendWelcomeBatch(saved, incoming, now = Date.now(), windowMs = 3 * 60 * 1000, batchId = String(now)) {
  const active = saved && Number(saved.flushAt) > now ? saved : null;
  return active
    ? { ...active, participants: mergeWelcomeParticipants(active.participants, incoming) }
    : {
        batchId,
        startedAt: now,
        flushAt: now + windowMs,
        participants: mergeWelcomeParticipants([], incoming)
      };
}

export function getEligibleIntroReminderEntries(pending = {}, now = Date.now(), delayMs = 10 * 60 * 1000) {
  return Object.entries(pending).filter(([, record]) =>
    record && record.introduced !== true && record.status !== 'inactive' &&
    !record.reminded && Number(record.joinedAt || 0) + delayMs <= now
  );
}

export function getNextIntroReminderAt(pending = {}, delayMs = 10 * 60 * 1000) {
  return Object.values(pending).reduce((earliest, record) => {
    if (!record || record.introduced === true || record.status === 'inactive' || record.reminded) return earliest;
    const eligibleAt = Number(record.joinedAt || 0) + delayMs;
    return eligibleAt < earliest ? eligibleAt : earliest;
  }, Infinity);
}


export function createWelcomeCampaign(participants = [], now = Date.now(), campaignId = String(now), durationMs = 10 * 60 * 1000) {
  const ids = [...new Set((participants || []).map(participant =>
    typeof participant === 'string'
      ? participant
      : (participant?.id || participant?.phoneNumber || participant?.lid)
  ).filter(id => typeof id === 'string' && id.includes('@') && !id.endsWith('@g.us')))];
  return {
    campaignId,
    startedAt: now,
    expiresAt: now + durationMs,
    participantIds: ids,
    status: 'active'
  };
}

export function isWelcomeCampaignActive(campaign, now = Date.now()) {
  return Boolean(campaign && campaign.status === 'active' && Number(campaign.expiresAt) > now);
}

export function buildWelcomeCampaignMessage(participants, template = '') {
  const mentions = [...new Set((participants || []).filter(id => typeof id === 'string' && id.length))];
  const mentionText = mentions.map(id => `@${id.split('@')[0]}`).join(', ');
  const lead = String(template || '📣 *GROUP INTRODUCTION CHECK*\\n\\nEveryone tagged below: please send at least one message in this group within the next 10 minutes. Any message counts for this check. Members who remain silent will be listed as yet to introduce themselves.').trim();
  return { text: `${lead}\\n\\n${mentionText}`, mentions };
}
