/**
 * Forge Guard dual-bank selector.
 * Selects the pair and side that best match the user's actual message.
 * A/B are contextual alternatives, not randomly interchangeable replies.
 */
import dualBank, {
  dualReasonedCore, dualReasonedExpand, dualYoruba, dualConversational,
  dualGist, dualFinancial, dualRelLife, dualExpansionStats, dualBankExpansionComplete,
} from './chatDual_expansion_index.js';

function mergeCategoryPools() {
  const pools = {};
  const addObj = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, arr] of Object.entries(obj)) {
      if (Array.isArray(arr)) (pools[k] ||= []).push(...arr);
    }
  };
  addObj(dualReasonedCore);
  addObj(dualReasonedExpand);
  const addArray = (arr, key) => {
    if (Array.isArray(arr)) (pools[key] ||= []).push(...arr);
  };
  addArray(dualYoruba, 'yoruba');
  addArray(dualConversational, 'conversational');
  addArray(dualGist, 'gist');
  addArray(dualFinancial, 'financialNeed');
  addArray(dualRelLife, 'relationship');
  return pools;
}

const dualPools = mergeCategoryPools();
const recentDual = new Map();
const STOP_WORDS = new Set(('about after again also and are because been before being but can could did does doing dont for from get got had has have how into its just like make more most much not now off our out over really should some than that the their them then there these they this those through too very was were what when where which while who why will with would you your').split(' '));

function terms(value) {
  return String(value || '').toLowerCase()
    .replace(/[^\p{L}\p{N}₦]+/gu, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

export function scoreResponseRelevance(input, response, context = []) {
  const responseTerms = new Set(terms(response));
  const currentTerms = terms(input);
  const contextTerms = terms(context.join(' '));
  let score = 0;
  for (const term of currentTerms) {
    if (responseTerms.has(term)) score += term.length > 6 ? 3 : 2;
  }
  for (const term of contextTerms) {
    if (responseTerms.has(term) && !currentTerms.includes(term)) score += 0.25;
  }
  return score;
}

function scorePair(pair, input, context = []) {
  const a = pair?.a ?? pair?.A;
  const b = pair?.b ?? pair?.B;
  if (typeof a !== 'string' || typeof b !== 'string') return null;
  const scoreA = scoreResponseRelevance(input, a, context);
  const scoreB = scoreResponseRelevance(input, b, context);
  return { pair, a, b, scoreA, scoreB, score: Math.max(scoreA, scoreB) };
}

function pickSide(scored, responseMode = 'reasoned') {
  if (!scored) return null;
  if (responseMode === 'a') return scored.a;
  if (responseMode === 'b') return scored.b;
  if (responseMode === 'both') return scored.a.trim() + '\n\n' + scored.b.trim();
  if (scored.scoreA > scored.scoreB) return scored.a;
  if (scored.scoreB > scored.scoreA) return scored.b;
  return Math.random() < 0.5 ? scored.a : scored.b;
}

function choosePair(chatId, category, input, previousReply = '', context = [], responseMode = 'reasoned') {
  const pool = dualPools[category];
  if (!Array.isArray(pool) || pool.length === 0) return null;
  const key = `${chatId || 'global'}:dual:${category}`;
  const recent = recentDual.get(key) || [];
  const blocked = new Set([previousReply, ...recent].filter(Boolean).map(String));
  const recentContext = context.slice(-8);
  const scored = pool
    .map(pair => scorePair(pair, input, recentContext))
    .filter(item => item && !blocked.has(item.a) && !blocked.has(item.b));
  const available = scored.length ? scored : pool.map(pair => scorePair(pair, input, recentContext)).filter(Boolean);
  if (!available.length) return null;

  // Prefer responses with real topical overlap; only fall back to a tie-break when the
  // message contains too little signal to distinguish the two sides.
  const bestScore = Math.max(...available.map(item => item.score));
  // Unmatched casual Pidgin should fall through to the personality bank, not a random advice pair.
  // Specialist banks retain their established fallback selection for short substantive prompts.
  if (bestScore <= 0 && category === 'conversational') return null;
  const shortlist = available.filter(item => item.score === bestScore);
  const selected = shortlist[Math.floor(Math.random() * shortlist.length)];
  const text = pickSide(selected, responseMode);
  if (!text) return null;
  recentDual.set(key, [...recent, text].slice(-30));
  return text;
}

const DIRTY_RE = /\b(fuck|sex|dick|pussy|ass|cum|horny|wet|hard|stroke|suck|ride|nudes?|naked|boobs?|nipple|throat|moan|orgasm|fantasy|blowjob|handjob|creampie|edge|edging|spank|choke|slut|whore|daddy|mommy|touch me|make me|use me|ruin me|dirty|filthy|nasty|explicit|talk dirty|be nasty)\b/i;
const SEX_ADVICE_RE = /\b(consent|aftercare|safe\s*word|safeword|protection|condom|sti|std|sexual health|how do i ask|boundaries in bed|kink safety|check in|continuous consent)\b/i;
const YORUBA_RE = /\b(bawo|ẹ n lẹ|e ku|mo dupe|jowo|abeg yoruba|sọ yorùbá|yoruba)\b/i;
const PIDGIN_RE = /\b(how far|wetin|dey|abeg|no be|make we|i dey|you dey|oya|na so|e hard)\b/i;
const MONEY_RE = /\b(money|cash|broke|salary|funds|₦|naira|price|budget|debt|loan|save|saving)\b/i;
const WELLBEING_RE = /\b(burnout|anxious|anxiety|depressed|stress|stressed|overwhelmed|sleep|tired|lonely|grief|shame|mental health|wellbeing|i feel)\b/i;
const RELATIONSHIP_RE = /\b(relationship|dating|boyfriend|girlfriend|partner|situationship|talking stage|breakup|break up|cheating|red flag|green flag|ghosting|breadcrumb|love bomb|consistency|initiate)\b/i;
const ADVICE_RE = /\b(what should i do|need advice|advise me|any advice|should i|help me decide)\b/i;

export function pickDualReply(text, options = {}) {
  if (!dualBankExpansionComplete) return null;
  const input = String(text || '').trim();
  if (!input) return null;
  const { chatId = 'global', previousReply = '', intent = null, context = [], responseMode = 'reasoned' } = options;
  if (DIRTY_RE.test(input) && !SEX_ADVICE_RE.test(input) && !/\b(advice|should i|is it ok|safe)\b/i.test(input)) return null;

  // Short follow-ups often rely on the previous turns ("what if they refuse?",
  // "and if it hurts?"). Use recent context to recover the topic only when the
  // current message does not introduce a clear new subject.
  // Carry history only for messages that linguistically depend on a prior turn.
  // Short standalone statements (slang, insults, definitions) are new turns, not follow-ups.
  const isContextualFollowUp = /^(?:and\b|but\b|so\b|then\b|why\b|how so\b|what about\b|what if\b|in that case\b|really\b|are you sure\b|then what\b|what should i do\b|yes\b|yeah\b|yep\b|no\b|nope\b|that\b|they\b|it\b|he\b|she\b|them\b|this\b)/i.test(input);
  const recentContext = isContextualFollowUp ? context.slice(-3) : [];
  const routeText = isContextualFollowUp ? [input, ...recentContext].join(' ') : input;

  let category = null;
  if (SEX_ADVICE_RE.test(routeText) || (DIRTY_RE.test(routeText) && /\b(advice|should i|is it ok|safe|consent)\b/i.test(routeText))) {
    category = dualPools.sexAdvice?.length ? 'sexAdvice' : null;
  } else if (YORUBA_RE.test(routeText) || intent === 'yoruba') {
    category = dualPools.yoruba?.length ? 'yoruba' : null;
  } else if (intent === 'financialNeed' || MONEY_RE.test(routeText)) {
    category = dualPools.financialNeed?.length ? 'financialNeed' : (dualPools.advice?.length ? 'advice' : null);
  } else if (intent === 'relationships' || intent === 'boundaries' || intent === 'friendship' || RELATIONSHIP_RE.test(routeText)) {
    category = dualPools.relationship?.length ? 'relationship' : null;
  } else if (intent === 'empathy' || intent === 'wellbeing' || WELLBEING_RE.test(routeText)) {
    category = dualPools.wellbeing?.length ? 'wellbeing' : (dualPools.advice?.length ? 'advice' : null);
  } else if (intent === 'advice' || intent === 'workLife' || ADVICE_RE.test(routeText)) {
    category = dualPools.advice?.length ? 'advice' : (dualPools.relationship?.length ? 'relationship' : null);
  } else if (intent === 'pidgin' || (PIDGIN_RE.test(routeText) && dualPools.conversational?.length)) {
    category = dualPools.conversational?.length ? 'conversational' : (dualPools.gist?.length ? 'gist' : null);
  } else if (intent === 'flirty' && dualPools.flirty?.length) {
    category = 'flirty';
  } else if (/\b(gist|spill|story|wahala)\b/i.test(routeText) && dualPools.gist?.length) {
    category = 'gist';
  }
  if (!category) return null;
  return choosePair(chatId, category, input, previousReply, recentContext, responseMode);
}

export function getDualBankStats() {
  return {
    complete: dualBankExpansionComplete,
    expansion: dualExpansionStats(),
    categories: Object.fromEntries(Object.entries(dualPools).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])),
  };
}
export { dualBankExpansionComplete, dualExpansionStats };
