const PIDGIN_MARKERS = [
  /\b(?:dey|wetin|abi|wahala|una|sef|sha|na|don|abeg|oya|nko|joor|jare|make we|no be|e be like|i no fit|you sabi|how far|wetin happen|werey|wery|ebi n pa mi|ebi n pa me|i dey hungry)\b/i,
  /\b(?:go chop|make i|no wahala|omo|wey|dem|am|una|wan|no wan)\b/i
];
const YORUBA_MARKERS = [
  /[ẹọṣẸỌṢ]/,
  /\b(?:ẹ|ẹ̀|ẹ́|ọ̀|ọ́|ṣé|ṣe|jẹ|jẹ́|kò|má|ẹ̀yin|ẹyin|ẹ̀gbọ́n|ọmọ|báwo|bawo|dáadáa|daadaa|pẹ̀lẹ́|ẹ kú|ẹ ku|e kaaro|e jowo|e seun|o seun|ẹ káàárọ̀|o ṣeun|ẹ ṣeun|mo fẹ́|mo ní|mo fe|mo ni|kí ni|ki ni|ṣé o|se o|bawo ni|nibo|tani|kini|àkókò|akoko|mélòó|meloo|ní|ni|Èkó|eko|báyìí|bayi)\b/i
];

function markerScore(text, patterns) {
  return patterns.reduce((score, pattern) => score + (pattern.test(text) ? 1 : 0), 0);
}

function classifyLanguage(input) {
  const pidginScore = markerScore(input, PIDGIN_MARKERS);
  const yorubaScore = markerScore(input, YORUBA_MARKERS);
  const words = input.toLowerCase().match(/[\p{L}]+/gu) || [];
  const pidginWords = words.filter(word =>
    /^(dey|wetin|abi|wahala|una|sef|sha|na|don|abeg|oya|nko|joor|jare|wey|dem|wan|werey|wery|omo)$/.test(word)
  ).length;
  const yorubaWords = words.filter(word =>
    /^(ẹ|ọ|ṣ|ṣe|jẹ|kò|ẹyin|ọmọ|báwo|bawo|dáadáa|daadaa|ki|nibo|tani|kini|àkókò|akoko|mélòó|meloo|ní|ni|Èkó|eko|báyìí|bayi)$/.test(word)
  ).length;

  const strongPidgin = /\b(dey|wetin|no be|no wan|no fit|i no fit|make i|make we|you sabi|e be like|how far|una|don|ebi n pa mi|ebi n pa me|i dey hungry)\b/i.test(input);
  if (yorubaScore > 0 && pidginScore > 0) {
    if (yorubaScore > pidginScore) return 'yoruba';
    if (pidginScore > yorubaScore && (strongPidgin || pidginWords > yorubaWords)) return 'pidgin';
    if (yorubaWords > pidginWords) return 'yoruba';
    if (pidginWords > yorubaWords && (strongPidgin || pidginWords >= 2)) return 'pidgin';
    return 'english';
  }
  if (yorubaScore > 0) return 'yoruba';
  if (pidginScore > 0 && (strongPidgin || pidginWords >= 2 || words.length <= 3)) return 'pidgin';
  return 'english';
}

export function detectMessageLanguage(text, history = []) {
  const input = String(text || '').trim();
  if (!input) return 'english';
  const detected = classifyLanguage(input);
  if (detected !== 'english') return detected;

  // Very short replies carry little language evidence. Inherit the last
  // confidently detected language from this participant's own transcript.
  const words = input.split(/\s+/).filter(Boolean);
  if (words.length <= 3 && Array.isArray(history)) {
    for (const item of [...history].reverse()) {
      if (String(item?.name || '').toLowerCase() === 'forge bot') continue;
      const prior = String(item?.text || '').trim();
      if (!prior || prior === input) continue;
      const priorLanguage = classifyLanguage(prior);
      if (priorLanguage !== 'english') return priorLanguage;
      const priorWords = prior.split(/\s+/).filter(Boolean);
      if (priorWords.length > 3 || /\b(yes|no|okay|ok|yeah|yep|nope|thanks|thank you|sure|fine|good|hello|hi|please|fair enough|makes sense|i agree)\b/i.test(prior)) return 'english';
    }
  }
  return 'english';
}

export function getLanguageInstruction(language = 'english') {
  const normalized = ['pidgin', 'yoruba', 'english'].includes(language) ? language : 'english';
  const instructions = {
    english: 'Reply entirely in clear, natural English. Do not switch to Pidgin or Yoruba unless the user does.',
    pidgin: 'Reply in natural Nigerian Pidgin throughout. Use fluent, everyday Nigerian Pidgin—not formal English with a few slang words. Keep technical names and unavoidable proper nouns unchanged.',
    yoruba: 'Reply in natural, correct Yoruba throughout. Use Yoruba orthography and tone marks where you can. Do not answer in English or Nigerian Pidgin; retain technical terms/proper nouns only when translation would be unclear.'
  };
  return instructions[normalized];
}

export function getLocalizedAnswerPrefix(language = 'english') {
  if (language === 'pidgin') return 'Answer na';
  if (language === 'yoruba') return 'Ìdáhùn ni';
  return 'The answer is';
}

export function getLocalizedFailureReply(language = 'english') {
  if (language === 'pidgin') return 'I no fit give you a reliable answer for that one right now. Abeg try again shortly.';
  if (language === 'yoruba') return 'Mi ò lè fún ọ ní ìdáhùn tó dájú báyìí. Jọ̀ọ́, tún gbìyànjú lẹ́yìn díẹ̀.';
  return "I couldn't produce a reliable answer to that just now. Please try again shortly.";
}

export function getLocalizedSourceSummaryFailure(language = 'english') {
  if (language === 'pidgin') return 'I don find recent sources, but I no fit arrange a verified summary right now. Check the links below directly:';
  if (language === 'yoruba') return 'Mo ti rí àwọn orísun tuntun, ṣùgbọ́n mi ò lè ṣe àkótán tó dájú báyìí. Jọ̀ọ́, ṣàyẹ̀wò àwọn ìjápọ̀ tó wà ní ìsàlẹ̀:';
  return "I found recent sources, but couldn't safely compose a verified summary just now. Please check the linked sources directly:";
}
