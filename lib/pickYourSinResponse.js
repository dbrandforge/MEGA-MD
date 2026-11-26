const MESSAGE_WRAPPERS = [
  'ephemeralMessage',
  'viewOnceMessage',
  'viewOnceMessageV2',
  'viewOnceMessageV2Extension',
  'documentWithCaptionMessage'
];

function unwrapMessage(message) {
  let current = message?.message || message || {};
  for (let depth = 0; depth < 5; depth += 1) {
    const wrapper = MESSAGE_WRAPPERS.find(key => current?.[key]?.message);
    if (!wrapper) break;
    current = current[wrapper].message;
  }
  return current;
}

export function isPickYourSinViewOnceMessage(message) {
  let current = message?.message || message || {};
  for (let depth = 0; depth < 5; depth += 1) {
    const wrapper = MESSAGE_WRAPPERS.find(key => current?.[key]?.message);
    if (!wrapper) return false;
    if (wrapper.startsWith('viewOnce')) return true;
    current = current[wrapper].message;
  }
  return false;
}

export function getPickYourSinMediaKind(message) {
  const content = unwrapMessage(message);
  if (content.audioMessage?.ptt === true) return 'voice';
  if (content.imageMessage) return 'image';
  if (content.videoMessage) return 'video';
  if (content.audioMessage) return 'audio';
  if (
    content.stickerMessage
    || content.documentMessage
    || content.documentWithCaptionMessage
    || content.contactMessage
    || content.locationMessage
    || content.liveLocationMessage
  ) return 'other';
  return 'text';
}

export function getPickYourSinMessageContext(message) {
  const content = unwrapMessage(message);
  return content.messageContextInfo
    || content.extendedTextMessage?.contextInfo
    || content.imageMessage?.contextInfo
    || content.videoMessage?.contextInfo
    || content.audioMessage?.contextInfo
    || {};
}

export function validatePickYourSinTruthAnswer(value) {
  const answer = String(value || '').normalize('NFKC').trim();
  if (!answer) return { accepted: false, reason: 'empty' };

  const words = answer.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || [];
  const normalized = answer.toLowerCase().replace(/[.!?,;:]+/g, ' ').replace(/\s+/g, ' ').trim();
  const shortRefusal = /^(?:no|nope|nah|never|yes|yeah|yep|done|finished|complete|i have|i haven't|i have not|i did|i didn't|i did not|not really|nothing|idk|i don't know|pass|skip)(?:\s+(?:at all|before|ever|yet|though|really|once|one|that|this|it|so))?$/i;

  if (shortRefusal.test(normalized)) {
    return { accepted: false, reason: 'non-answer' };
  }
  if (words.length < 12) {
    return { accepted: false, reason: 'too-short' };
  }

  const uniqueWords = new Set(words.map(word => word.toLowerCase()));
  if (uniqueWords.size < 8) {
    return { accepted: false, reason: 'repetitive' };
  }

  // Truth cards are open-ended and ask for a personal account, explanation,
  // comparison or description. Require narrative/personal detail, not padding.
  const detailSignal = /\b(?:i|me|my|mine|we|our|when|because|after|before|once|then|first|last|felt|feel|happened|thought|told|said|went|made|got|tried|remember|experience|reason|actually|specific|time|person|place|moment)\b/i;
  if (!detailSignal.test(answer)) {
    return { accepted: false, reason: 'no-personal-detail' };
  }

  return { accepted: true, reason: 'substantive' };
}
