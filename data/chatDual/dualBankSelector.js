/**
 * Forge Guard dual-bank selector.
 * Picks {a,b} reasoning pairs from the 5,183-pair ChatDual expansion.
 * Does not replace personalityBank; returns null to fall through.
 *
 * Routing rules:
 * - Explicit dirty talk → leave to personalityBank.dirty (this module returns null)
 * - Sexual-health / consent / aftercare / safe-word framing → dual sexAdvice
 * - Relationship / boundaries / situationship advice → dual relationship
 * - Wellbeing / stress / burnout → dual wellbeing
 * - Money / financial need → dual financial / advice
 * - Yoruba / pidgin conversational → dual yoruba / conversational / gist
 */
import dualBank, {
  dualReasonedCore,
  dualReasonedExpand,
  dualYoruba,
  dualConversational,
  dualGist,
  dualFinancial,
  dualRelLife,
  dualExpansionStats,
  dualBankExpansionComplete,
} from './chatDual_expansion_index.js';

function mergeCategoryPools() {
  const pools = {};
  const addObj = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, arr] of Object.entries(obj)) {
      if (!Array.isArray(arr)) continue;
      if (!pools[k]) pools[k] = [];
      pools[k].push(...arr);
    }
  };
  addObj(dualReasonedCore);
  addObj(dualReasonedExpand);

  const asPairs = (arr, key) => {
    if (!Array.isArray(arr)) return;
    if (!pools[key]) pools[key] = [];
    pools[key].push(...arr);
  };
  asPairs(dualYoruba, 'yoruba');
  asPairs(dualConversational, 'conversational');
  asPairs(dualGist, 'gist');
  asPairs(dualFinancial, 'financialNeed');
  asPairs(dualRelLife, 'relationship');

  return pools;
}

const dualPools = mergeCategoryPools();
const recentDual = new Map();

function pickSide(pair) {
  if (!pair || typeof pair !== 'object') return null;
  const a = pair.a ?? pair.A;
  const b = pair.b ?? pair.B;
  if (typeof a !== 'string' || typeof b !== 'string') return null;
  return Math.random() < 0.55 ? a : b;
}

function choosePair(chatId, category, previousReply = '') {
  const pool = dualPools[category];
  if (!Array.isArray(pool) || pool.length === 0) return null;
  const key = `${chatId || 'global'}:dual:${category}`;
  const recent = recentDual.get(key) || [];
  const blocked = new Set([previousReply, ...recent].filter(Boolean).map(String));

  const candidates = pool.filter((p) => {
    const a = p?.a ?? p?.A;
    const b = p?.b ?? p?.B;
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    return !blocked.has(a) && !blocked.has(b);
  });
  const use = candidates.length ? candidates : pool;
  const pair = use[Math.floor(Math.random() * use.length)];
  const text = pickSide(pair);
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

/**
 * Try dual bank first for advice-shaped intents.
 * Returns null for pure dirty talk so personalityBank.dirty keeps ownership.
 */
export function pickDualReply(text, options = {}) {
  if (!dualBankExpansionComplete) return null;
  const input = String(text || '').trim();
  if (!input) return null;
  const { chatId = 'global', previousReply = '', intent = null } = options;

  if (DIRTY_RE.test(input) && !SEX_ADVICE_RE.test(input) && !/\b(advice|should i|is it ok|safe)\b/i.test(input)) {
    return null;
  }

  let category = null;

  if (SEX_ADVICE_RE.test(input) || (DIRTY_RE.test(input) && /\b(advice|should i|is it ok|safe|consent)\b/i.test(input))) {
    category = dualPools.sexAdvice?.length ? 'sexAdvice' : null;
  } else if (YORUBA_RE.test(input) && dualPools.yoruba?.length) {
    category = 'yoruba';
  } else if (intent === 'financialNeed' || MONEY_RE.test(input)) {
    category = dualPools.financialNeed?.length ? 'financialNeed' : (dualPools.advice?.length ? 'advice' : null);
  } else if (intent === 'relationships' || intent === 'boundaries' || intent === 'friendship' || RELATIONSHIP_RE.test(input)) {
    category = dualPools.relationship?.length ? 'relationship' : null;
  } else if (intent === 'empathy' || WELLBEING_RE.test(input)) {
    category = dualPools.wellbeing?.length ? 'wellbeing' : (dualPools.advice?.length ? 'advice' : null);
  } else if (intent === 'advice' || intent === 'workLife' || ADVICE_RE.test(input)) {
    category = dualPools.advice?.length ? 'advice' : (dualPools.relationship?.length ? 'relationship' : null);
  } else if (intent === 'yoruba' && dualPools.yoruba?.length) {
    category = 'yoruba';
  } else if (intent === 'pidgin' || (PIDGIN_RE.test(input) && dualPools.conversational?.length)) {
    category = dualPools.conversational?.length ? 'conversational' : (dualPools.gist?.length ? 'gist' : null);
  } else if (intent === 'flirty' && dualPools.flirty?.length) {
    category = 'flirty';
  } else if (/\b(gist|spill|story|wahala)\b/i.test(input) && dualPools.gist?.length) {
    category = 'gist';
  }

  if (!category) return null;
  return choosePair(chatId, category, previousReply);
}

export function getDualBankStats() {
  return {
    complete: dualBankExpansionComplete,
    expansion: dualExpansionStats(),
    categories: Object.fromEntries(
      Object.entries(dualPools).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])
    ),
  };
}

export { dualBankExpansionComplete, dualExpansionStats };
