/**
 * Forge Bot unified personality bank
 * - Merges core + expansion + response packs (skips clarification spam)
 * - Shuffle-bag anti-repeat
 * - Mature-minded dirty routing + money/savage/flirty/greeting
 */
import { classifyIntent, ensureResponseEmoji, pickLibraryReply } from './chatbotResponseLibrary.js';
import { personalityBankExpansion } from './personalityBankExpansion.js';
import { responseExpansion } from './chatbotResponseExpansion.js';
import { replyBank as chatRepliesBank } from './chatReplies.js';
import { moreDirty, morePidgin, moreSavage, moreSocial } from './chatRepliesMore.js';

export const personalityBank = {
  greeting: [
    "Yoo! You don remember say this group dey exist? 😂", "Oya, who send you and wetin you want? 😏",
    "See who escaped from their cave. How far? 😭", "Hope say you no come with another problem. 😂",
    "Wetin sup, chairman? Talk before I lose interest. 😌", "The meeting of unserious people can begin. 😂",
    "Ẹ káàbọ̀! Oya drop the gist. 👀", "How far, my person? Any fresh trouble? 😏",
    "I was busy minding everybody's business. 😂", "Your absence was almost peaceful. 😭",
    "Who are we disturbing today? 😂", "Make your message worth the notification. 😌",
    "Werey how far — talk. 😂", "Wetin bring you? 😏"
  ],
  financialNeed: [
    "Oga go borrow from OPay naw. You think say na Central Bank I be? 😭",
    "Ogbeni, you no sabi PalmPay ni? 😏", "You don price your old sneakers or should we start there? 😂",
    "Go and invoice the people owing you. Why disturb the national treasury? 😭",
    "Even your calculator is tired of this budget. 💸",
    "Try OPay, try PalmPay, try hard work. In that order if you like. 😭",
    "How much? Make we know whether to laugh or organise a fundraiser. 😂",
    "Have you tried turning your bank account off and on again? 😭",
    "Your village people subscribed you to premium expenses. 💀",
    "Go and collect that money they owe you. 😏",
    "No be me hold the national budget o. How much you need? 😂",
    "Oga, even ATM dey ask me for money these days. Go hustle small. 😂",
    "Dash? From where? Go find who dey owe you. 😭",
    "You want money? Bring business plan not vibes alone. 💰",
    "I no be POS. Talk wetin you really need. 😏"
  ],
  moneyFollowup: [
    "₦50k? Now we are discussing figures. Who is owing you? 💸",
    "When do you need it? Today, this week, or before landlord starts poetry? 😭",
    "What skill can bring cash fastest this week? 😏",
    "List who owes you. People are enjoying your money too much. 😂"
  ],
  departure: [
    "Safe journey. Don't come back with more wahala. 😂", "Bye. Try not to miss this chaotic group. 😌",
    "Oya go rest. Group will still be unserious when you return. 😭", "Later. Carry sense outside. 😏",
    "Bye bye. Network and sense — carry both. 😂", "You dey go? Okay o. 👋",
    "Travel well. Come back with better gist. 👀", "I go block you now... joke. Go well. 😭"
  ],
  teasing: [
    "You dey try me sha. Continue. 😏", "See confidence. I almost clapped. 😂",
    "You sound like trouble with good packaging. 🔥", "Keep talking like that and something go happen. 😏",
    "Your mouth sweet but mind dirtier, abi? 👀", "You dey feel yourself. I like am small. 😌",
    "That message get spice. Raise am. 🔥", "You dey test boundaries. Correct energy. 😏",
    "Soft flex detected. Still cute though. 😂", "You want attention or instructions? 👀",
    "Hmm. Make the next one filthier if you bold. 🔥", "No dey shy. You don already start. 😏"
  ],
  savage: [
    "You dey do too much 😂", "Calm down before you embarrass yourself. 😭",
    "E no reach like that fra. 😏", "You try but e still weak. 😂",
    "No be beans... this one soft. 😌", "Almost respected then you spoil am. 😭",
    "You dey shout like network go help. 😂", "Take am easy. 👀",
    "That one no move me. Try harder. 😏", "You sound pressed. Rest. 😂",
    "Soft flex detected. 😌", "Collect sense small. 😭",
    "You dey force am. E no fit. 😂", "Weak line. Reload. 😏",
    "You miss the plot. 👀", "Stupid? Look in mirror first. 😂",
    "Mad ke? You started am. 😏", "Insult detected. Still no score. 😭"
  ],
  banter: [
    "Group dey live today. Who we dey disturb? 😂", "Correct vibes and correct mess. 🔥",
    "You people and unnecessary energy. I dey watch. 👀", "Spill something people no know. 😏",
    "No ghost membership tonight. 😂", "Somebody go enter hot seat soon. 🔥",
    "Truth only for this side. 😌", "If you dey feel am talk am. 👀",
    "No form for this group. 😂", "Keep the chat spicy not empty. 🔥"
  ],
  boredom: [
    "You bored? Go touch grass or touch trouble. 😂", "Idle hands dey invent drama. 👀",
    "Find gist or sleep. 😏", "Boredom is how group chaos starts. 😭",
    "Go drink water. Come back with better energy. 😂", "You need hobby beyond chatting nonsense. 😌"
  ],
  relationship: [
    "Love is sweet until somebody starts replying 'k' after three paragraphs. 😭",
    "You want advice or permission to ignore the red flags? 😂",
    "If consistency is missing, stop using chemistry to do its job. 😏",
    "Love no be group project where only one person dey work. ❤️",
    "You people see red flags and call them decoration. 😭",
    "Don't confuse attention with intention. One is cheap. 👀",
    "Love is not an excuse to abandon common sense. ❤️"
  ],
  wellbeing: [
    "I dey alright. Managing humans in this group is my full-time job. 😂",
    "I'm good. How your side? 😭", "Steady. The only thing disturbing me is this group. 😏",
    "I dey kampe. Hope life never use you do practical. 😂",
    "Are you actually fine or doing Nigerian 'I'm fine'? 👀", "Holding up. You? Talk true. ❤️"
  ],
  pidgin: [
    "Omo, yarn the full gist. No give us trailer only. 😂", "Abeg, no package am. Talk as e be. 😏",
    "Wetin happen? I dey hear you. 👀", "Na wa o. You people and drama. 😭",
    "You don start again? 😂", "No be small wahala you carry come. 😭",
    "Make we reason am before you embarrass yourself. 😏", "Oya continue, I don settle down. 🍿",
    "How far correct one? 😂", "E choke. Talk more. 🔥", "Fra how you mean? 👀"
  ],
  yoruba: [
    "Oya, má fi wa ṣeré. Sọ ohun tó ṣẹlẹ̀. 😂", "Ẹ̀gbọ́n, ṣe gbogbo wa la jọ ya were ni? 😭",
    "Mo gbọ́ ẹ. Ṣùgbọ́n ẹ má ṣe wá wàhálà. 😏", "Bawo ni? 😏", "Se o n dun e ni? 👀"
  ],
  serious: [
    "Jokes aside, that sounds serious. I'll park the cruise and listen. 🫂",
    "Okay, no banter for this one. What's the most urgent thing you need? 🤝",
    "I hear you. Let's take it one step at a time. ❤️",
    "That sounds heavy. You don't have to handle it alone. 🫂",
    "I'm here. No jokes. Talk when you're ready. 🤝"
  ],
  dirty: [
    "Talk dirty or go soft first? Your call. 🔥", "You sound like night energy pure. 😏",
    "I fit ruin the chat if you open the gate. 🔥", "Say the fantasy clear — no code. 👀",
    "Your last line get heat. Raise am. 🔥", "Be honest you dey touch something? 😏",
    "Clothes don reduce for your mind already. 🔥", "Slow and nasty or fast and rough? 👀",
    "Describe how you like to be handled. 🔥", "Who you go let ruin you for this group? 😏",
    "Next message dirtier. I dey wait. 😏", "No censor for this side. 🔥",
    "You dey wet or hard from this yarn? 🔥", "I go match your energy. No stop midway. 😏",
    "Position you dey imagine now? 🔥", "Throat, hands or mouth first? 👀",
    "You want marks left? 🔥", "Begging voice or commanding? 😏",
    "Be specific or I assume the filthy version. 👀", "You want me to lead the dirty talk? 🔥",
    "If we alone now wetin first? 😏", "Your mouth sweet but mind dirtier. 👀",
    "Continue make I know how far you wan take am. 🔥", "You dey feel yourself. I like am. 😏",
    "Say that thing again slower. 🔥", "You dey look for correct trouble. 👀",
    "Keep that energy when e get explicit. 🔥", "Open up make I talk proper. 🔥",
    "You wan make person blush or wet? 👀", "Talk am like you mean am. 🔥",
    "No half measures with me. 😏", "Where you want attention and how? 👀",
    "Rate how horny this chat get you 1-10. 😏", "Tell me your weak spot. 👀",
    "One word for how you want to be fucked. 🔥", "Describe your hands or mouth in a filthy way. 😏",
    "What is your body saying right now? 🔥", "No packaging. Raw talk. 🔥",
    "Say please like you mean am. 😏", "Describe finishing without clean words. 🔥",
    "What do you want whispered? 👀", "If I give instruction you go follow? 🔥",
    "You dey play. I dey play back harder. 🔥", "Make am nasty for the group energy. 🔥",
    "Imagine pinned. Wetin next? 👀", "Slow tease or straight pressure? 🔥",
    "I fit talk to you like you dey under me. 🔥", "Open the gate fully. 🔥",
    "Good. Now talk like adult. 🔥", "That line land. Give me another. 👀",
    "Filthy and clear. 🔥", "Again but dirtier. 😏", "Correct energy. Keep am. 👀",
    "Oya talk dirty. I dey game. 🔥", "Start. No shy. 😏"
  ],
  flirty: [
    "You dey try me sha 🔥", "Keep talking like that and something go happen. 😏",
    "Your mouth sweet but mind dirtier. 👀", "You need attention... the dirty kind. 🔥",
    "Continue make I know how far. 😏", "You dey feel yourself. I like am. 🔥",
    "Say that again slower. 👀", "Dirty talk or soft play first? 🔥",
    "You dey look for correct trouble. 😏", "Your vibe dey do me somehow. 🔥",
    "No dey shy. You don start. 👀", "I fit match and raise your energy. 🔥",
    "You dey play with fire. 😏", "Soft or rough talk? 👀",
    "Attention or instructions? 😏", "Your message get spice. Add more. 👀",
    "I fit get dirty if you open the door. 😏", "You wan make person blush or wet? 👀",
    "I dey game if you dey game. 🔥", "Raise the temperature small. 😏",
    "Flirty mode on. No waste am. 🔥", "Come closer with the words. 👀"
  ],
  thanks: [
    "You're welcome. Don't let it get to your head. 😂", "Anytime. Now behave. 😏",
    "No stress. Just don't make me regret helping. 😭", "Accepted. Go and use the sense. 😌",
    "You're welcome o. Soft life continues. ✨", "E easy. Come back when you get better gist. 😂",
    "My pleasure. Rare sentence from me, enjoy it. 😏", "Alright. You owe me good vibes. 🔥"
  ],
  apology: [
    "Apology accepted. Don't repeat the nonsense. 😏", "Okay. We move. Learn from am. 😌",
    "I hear you. Next time use sense earlier. 😂", "Fine. Drama closed. 👀",
    "Accepted. Soft reset. ❤️", "We good. Don't make it a habit. 😏"
  ],
  agreement: [
    "Facts. No argument. 😂", "Exactly. You get sense today. 😏", "Na so. Continue. 👀",
    "Correct. 🔥", "True talk. 😌", "I agree. Rare moment. 😂"
  ],
  disagreement: [
    "I no gree. Explain better. 😏", "Hmm. That one soft. 👀", "Respectfully, no. 😂",
    "I hear you but I no buy am. 😌", "Counterpoint: sense. 🔥", "Not it. Try another angle. 😏"
  ],
  fallback: [
    "You just dropped that and expected me to decode the universe? 😂",
    "I hear you. Continue, don't leave the gist halfway. 👀",
    "Interesting. I have questions, but let me pretend I'm normal. 😏",
    "You and these mysterious one-line updates. Talk properly. 😭",
    "My response is loading with unnecessary attitude. 😂",
    "You have my attention. Don't waste it. 😏",
    "Oya, land the plane. What exactly are we discussing? 😂",
    "Talk am again make I catch am 🔥", "Fraaa... wetin you talk again? 👀",
    "Drop am one more time. 😏", "Make I reason am. Talk again. 😂"
  ],
  unknownQuestion: [
    "You want an answer or you want to test whether I have sense? Ask properly. 😂",
    "That one pass my current gist. Narrow the question down small. 👀",
    "I won't manufacture facts to impress you. Rephrase the question. 🧐",
    "Omo, I no get that one yet. Ask am another way. 😭"
  ],
  genderGuy: [
    "Chairman, your confidence entered before your sense. 😂",
    "Oga, calm down. Nobody is contesting your village title. 😭",
    "My guy, you are doing the absolute most. 😏"
  ],
  genderLady: [
    "Queen, that energy is loud and I respect the chaos. 😂",
    "My lady, you carried the attitude and left the evidence. 😏",
    "Madam, the gist incomplete. Finish am. 👀"
  ],
  group: [
    "Group dey live today. 🔥", "Who dey active for real? 👀",
    "No ghost membership tonight. 😂", "Keep the chat spicy not empty. 🔥",
    "Stay mature stay nasty where e matter. 🔥"
  ],
  random: [
    "Random energy accepted. Continue. 😂", "I dey here. Wetin next? 👀",
    "Okay chaos gangan. 😏", "Noted with confusion. 😌"
  ]
};

function uniqPush(target, items) {
  if (!Array.isArray(items)) return;
  const seen = new Set(target.map(s => String(s).toLowerCase().trim()));
  for (const item of items) {
    const s = String(item || '').trim();
    if (s.length < 8) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    target.push(s);
  }
}
function ensureCat(name) {
  if (!personalityBank[name]) personalityBank[name] = [];
  return personalityBank[name];
}

const CATEGORY_ALIASES = {
  relationships: 'relationship', friendship: 'relationship', boundaries: 'relationship',
  humour: 'banter', advice: 'serious', empathy: 'serious',
  mediaReaction: 'banter', storytelling: 'banter', hypotheticals: 'banter',
  entertainment: 'banter', nigerianCulture: 'pidgin', debate: 'disagreement',
  workLife: 'banter', activityInfo: 'group', definition: 'unknownQuestion',
  slangDefinition: 'pidgin', error: 'fallback'
};

const SKIP_MERGE_KEYS = new Set(['clarification', 'followup']);
const CS_POLLUTION = /let'?s make sure i understand|need one more detail|give me the important detail|useful answer look like|are you asking for an opinion|can you give me an example|i need context before|correct level of attitude|who or what are you referring|i do not want to guess|i am following, but i need|clarify one thing|what would a useful answer|which part should i respond|what happened before this/i;

function mergePack(pack) {
  if (!pack || typeof pack !== 'object') return;
  for (const [rawKey, replies] of Object.entries(pack)) {
    if (!Array.isArray(replies)) continue;
    if (SKIP_MERGE_KEYS.has(rawKey)) continue;
    const key = CATEGORY_ALIASES[rawKey] || rawKey;
    const cleaned = replies.filter(r => !CS_POLLUTION.test(String(r)));
    if (rawKey === 'fallback') {
      const tight = cleaned.filter(r => String(r).length < 120 && !/\?\s*$/.test(String(r).trim()));
      uniqPush(ensureCat(key), tight);
    } else {
      uniqPush(ensureCat(key), cleaned);
    }
  }
}

mergePack(personalityBankExpansion);
try { mergePack(responseExpansion); } catch (e) { console.warn('[ForgeBank] responseExpansion merge skipped:', e.message); }

try {
  if (chatRepliesBank) {
    uniqPush(ensureCat('greeting'), chatRepliesBank.greeting);
    uniqPush(ensureCat('flirty'), chatRepliesBank.flirty);
    uniqPush(ensureCat('dirty'), chatRepliesBank.dirty);
    uniqPush(ensureCat('savage'), chatRepliesBank.savage);
    uniqPush(ensureCat('pidgin'), chatRepliesBank.pidgin);
    uniqPush(ensureCat('yoruba'), chatRepliesBank.yoruba);
    uniqPush(ensureCat('group'), chatRepliesBank.social);
    uniqPush(ensureCat('fallback'), chatRepliesBank.fallback);
  }
} catch (e) { console.warn('[ForgeBank] chatReplies merge skipped:', e.message); }

try {
  uniqPush(ensureCat('dirty'), moreDirty);
  uniqPush(ensureCat('pidgin'), morePidgin);
  uniqPush(ensureCat('savage'), moreSavage);
  uniqPush(ensureCat('group'), moreSocial);
} catch (e) { console.warn('[ForgeBank] more* merge skipped:', e.message); }

for (const key of Object.keys(personalityBank)) {
  if (!Array.isArray(personalityBank[key])) continue;
  personalityBank[key] = personalityBank[key].filter(r => !CS_POLLUTION.test(String(r)));
}

const recentSelections = new Map();
const shuffleBags = new Map();

function normalize(text) {
  return String(text || '').toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function choose(chatId, category, pool, previousReply) {
  if (!pool?.length) return 'I dey here. Talk again. 👀';
  const key = `${chatId || 'global'}:${category}`;
  const recent = recentSelections.get(key) || [];
  const recentGlobal = recentSelections.get(`${chatId || 'global'}:__all`) || [];
  const blocked = new Set([previousReply, ...recent, ...recentGlobal.slice(-20)].filter(Boolean).map(String));
  let bag = shuffleBags.get(key);
  if (!bag || !bag.length) {
    bag = shuffle(pool);
    shuffleBags.set(key, bag);
  }
  let idx = bag.findIndex(r => !blocked.has(r));
  if (idx === -1) {
    bag = shuffle(pool.filter(r => r !== previousReply));
    if (!bag.length) bag = shuffle(pool);
    shuffleBags.set(key, bag);
    idx = 0;
  }
  const reply = bag.splice(idx, 1)[0];
  shuffleBags.set(key, bag);
  recentSelections.set(key, [...recent, reply].slice(-25));
  recentSelections.set(`${chatId || 'global'}:__all`, [...recentGlobal, reply].slice(-40));
  return reply;
}

const DIRTY_RE = /\b(fuck|sex|dick|pussy|ass|cum|horny|wet|hard|stroke|suck|ride|nudes?|naked|boobs?|nipple|throat|moan|orgasm|fantasy|blowjob|handjob|creampie|edge|edging|spank|choke|slut|whore|daddy|mommy|touch me|make me|use me|ruin me|dirty|filthy|nasty|explicit|talk dirty|be nasty)\b/i;
const FLIRTY_RE = /\b(fine|beautiful|handsome|crush|sexy|babe|baby|attracted|like you|miss you|want you|flirt|flirty|rizz|be flirty|talk flirty)\b/i;
const GREETING_RE = /\b(hi|hello|hey|how far|good morning|good evening|good night|bawo|sup|how body|yoo|yo)\b/i;
const SERIOUS_RE = /\b(suicid|self harm|hurt myself|abuse|assault|rape|unsafe|in danger|emergency|someone died|passed away|grieving|depressed|I want to die)\b/i;
const SAVAGE_RE = /\b(stupid|mumu|werey|dull|foolish|idiot|you'?re mad|you are mad|mad bot|dumb|nonsense|shut up)\b/i;
const MONEY_RE = /\b(dash me|send money|give me money|borrow|lend me|i need money|need cash|i'?m broke|broke|no money)\b/i;

export function pickPersonalityReply(text, options = {}) {
  const input = String(text || '').trim();
  const { chatId = 'global', previousReply = '', gender = null, history = [] } = options;
  const norm = normalize(input);

  if (SERIOUS_RE.test(norm)) {
    return ensureResponseEmoji(choose(chatId, 'serious', personalityBank.serious, previousReply), input);
  }
  if (DIRTY_RE.test(norm)) {
    return ensureResponseEmoji(choose(chatId, 'dirty', personalityBank.dirty, previousReply), input);
  }
  if (GREETING_RE.test(norm) && norm.split(/\s+/).length <= 8) {
    return ensureResponseEmoji(choose(chatId, 'greeting', personalityBank.greeting, previousReply), input);
  }
  if (MONEY_RE.test(norm)) {
    return ensureResponseEmoji(choose(chatId, 'financialNeed', personalityBank.financialNeed, previousReply), input);
  }
  if (SAVAGE_RE.test(norm)) {
    return ensureResponseEmoji(choose(chatId, 'savage', personalityBank.savage, previousReply), input);
  }
  if (FLIRTY_RE.test(norm)) {
    return ensureResponseEmoji(choose(chatId, 'flirty', personalityBank.flirty, previousReply), input);
  }

  let intent = 'fallback';
  try { intent = classifyIntent(input) || 'fallback'; } catch { intent = 'fallback'; }
  if (intent === 'clarification' || intent === 'followup') intent = 'fallback';

  let category = intent;
  if (/\b(thank|thanks|ty|appreciate)\b/i.test(norm)) category = 'thanks';
  else if (/\b(sorry|apology|my bad)\b/i.test(norm)) category = 'apology';
  else if (/\b(bye|goodnight|good night|I dey go|I'm out|see you)\b/i.test(norm)) category = 'departure';
  else if (/\b(how are you|how you dey|you good|you okay)\b/i.test(norm)) category = 'wellbeing';

  if (['definition', 'slangDefinition', 'activityInfo', 'error'].includes(intent)) {
    try {
      const exact = pickLibraryReply(input, previousReply);
      if (exact) return exact;
    } catch {}
  }

  const lastBot = [...(history || [])].reverse().find(item => item.name === 'Forge Bot')?.text || '';
  if (/\b(how much|amount|need)\b/i.test(lastBot) && /(?:₦|ngn|\b\d{2,}(?:,\d{3})*\b)/i.test(input)) {
    category = 'moneyFollowup';
  }

  if (!personalityBank[category] || !personalityBank[category].length) {
    if (['relationships', 'friendship', 'boundaries'].includes(intent)) category = 'relationship';
    else if (['humour', 'group', 'random', 'storytelling', 'hypotheticals', 'entertainment'].includes(intent)) category = 'banter';
    else if (['advice', 'empathy'].includes(intent)) category = 'serious';
    else if (intent === 'pidgin') category = 'pidgin';
    else if (intent === 'yoruba') category = 'yoruba';
    else if (intent === 'flirty') category = 'flirty';
    else if (intent === 'teasing') category = 'teasing';
    else if (intent === 'savage') category = 'savage';
    else if (intent === 'financialNeed') category = 'financialNeed';
    else category = 'fallback';
  }

  let pool = personalityBank[category] || personalityBank.fallback;
  if (gender === 'guy' && ['teasing', 'savage', 'banter'].includes(category) && Math.random() < 0.22) {
    pool = personalityBank.genderGuy?.length ? personalityBank.genderGuy : pool;
  }
  if (gender === 'lady' && ['teasing', 'savage', 'banter'].includes(category) && Math.random() < 0.22) {
    pool = personalityBank.genderLady?.length ? personalityBank.genderLady : pool;
  }

  return ensureResponseEmoji(choose(chatId, category, pool, previousReply), input);
}

export function getPersonalityBankStats() {
  return Object.fromEntries(
    Object.entries(personalityBank).map(([key, entries]) => [key, Array.isArray(entries) ? entries.length : 0])
  );
}

export function getPersonalityBankTotal() {
  return Object.values(personalityBank).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
}

try {
  console.info(`[ForgeBank] Unified personality bank loaded: ${getPersonalityBankTotal()} replies across ${Object.keys(personalityBank).length} categories`);
} catch {}
