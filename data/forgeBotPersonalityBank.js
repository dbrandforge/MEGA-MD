/**
 * Forge Bot unified personality bank
 * - Merges core + expansion + response library expansion + chatReplies packs
 * - Shuffle-bag anti-repeat per chat+category
 * - Intent routing including Mature-minded explicit (dirty)
 */
import { classifyIntent, ensureResponseEmoji, pickLibraryReply } from './chatbotResponseLibrary.js';
import { personalityBankExpansion } from './personalityBankExpansion.js';
import { chatbotResponseExpansion } from './chatbotResponseExpansion.js';
import { replyBank as chatRepliesBank } from './chatReplies.js';
import { moreDirty, morePidgin, moreSavage, moreSocial } from './chatRepliesMore.js';

// ---------- Core bank (existing tone + explicit dirty pool) ----------
export const personalityBank = {
  greeting: [
    "Yoo! You don remember say this group dey exist? 😂","Oya, who send you and wetin you want? 😏",
    "See who escaped from their cave. How far? 😭","Hope say you no come with another problem. 😂",
    "Wetin sup, chairman? Talk before I lose interest. 😌","The meeting of unserious people can begin. 😂",
    "Ẹ káàbọ̀! Oya drop the gist. 👀","How far, my person? Any fresh trouble? 😏",
    "I was busy minding everybody's business. 😂","Your absence was almost peaceful. 😭",
    "Who are we disturbing today? 😂","Make your message worth the notification. 😌"
  ],
  financialNeed: [
    "Oga go borrow from OPay naw. You think say na Central Bank I be? 😭",
    "Ogbeni, you no sabi PalmPay ni? 😏","You don price your old sneakers or should we start there? 😂",
    "Go and invoice the people owing you. Why disturb the national treasury? 😭",
    "Even your calculator is tired of this budget. 💸","Try OPay, try PalmPay, try hard work. In that order if you like. 😭",
    "How much? Make we know whether to laugh or organise a fundraiser. 😂",
    "Have you tried turning your bank account off and on again? 😭",
    "Your village people subscribed you to premium expenses. 💀",
    "Go and collect that money they owe you. You are doing charity with your sweat. 😏",
    "No be me hold the national budget o. How much you need? 😂",
    "Sell that unused confidence. It looks like your most valuable asset. 😭",
    "Oga, even ATM dey ask me for money these days. Go hustle small. 😂",
    "Try a legit side gig before borrowing from people that owe you. 💰",
    "If na urgent, tell me amount and deadline. No enter loan-app wahala. 😏",
    "Your account balance is playing hide and seek. Go find am. 😂"
  ],
  moneyFollowup: [
    "₦50k? Now we are discussing figures. Who is owing you? 💸",
    "When do you need it? Today, this week, or before landlord starts composing poetry? 😭",
    "₦50k no be small change. What skill can bring cash fastest? 😏",
    "List who owes you. People are enjoying your money too much. 😂",
    "Okay, what's your fastest realistic source of income this week? 💰"
  ],
  departure: [
    "Safe journey. Don't come back with more wahala. 😂","Bye. Try not to miss this chaotic group too much. 😌",
    "Oya go rest. The group will still be unserious when you return. 😭","Later. Don't forget your common sense outside. 😏",
    "Bye bye. Network and sense — carry both. 😂","You dey go? Okay o, make we no hold you. 👋",
    "Travel well. Come back with better gist. 👀","I go block you now... joke. Go well. 😭",
    "Soft landing. Don't start drama in another group immediately. 😂","Goodnight energy early? Fine. Later. 🌙"
  ],
  teasing: [
    "You dey try me sha. Continue. 😏","See confidence. I almost clapped. 😂",
    "You sound like trouble with good packaging. 🔥","Keep talking like that and something go happen. 😏",
    "Your mouth sweet but mind dirtier, abi? 👀","You dey feel yourself. I like am small. 😌",
    "That message get spice. Raise am. 🔥","You dey test boundaries. Correct energy. 😏",
    "Soft flex detected. Still cute though. 😂","You want attention or you want instructions? 👀",
    "Hmm. Make the next one filthier if you bold. 🔥","No dey shy. You don already start. 😏",
    "Your vibe dey do me somehow. 😌","I fit match and raise your energy. 🔥"
  ],
  savage: [
    "You dey do too much 😂","Calm down before you embarrass yourself. 😭",
    "E no reach like that fra. 😏","You try but e still weak. 😂",
    "No be beans... this one soft. 😌","Almost respected then you spoil am. 😭",
    "You dey shout like network go help. 😂","Take am easy. 👀",
    "That one no move me. Try harder. 😏","You sound pressed. Rest. 😂",
    "Soft flex detected. 😌","Collect sense small. 😭",
    "You dey force am. E no fit. 😂","Weak line. Reload. 😏",
    "You miss the plot. 👀"
  ],
  banter: [
    "Group dey live today. Who we dey disturb? 😂","Correct vibes and correct mess. 🔥",
    "You people and unnecessary energy. I dey watch. 👀","Spill something people no know. 😏",
    "No ghost membership tonight. 😂","Somebody go enter hot seat soon. 🔥",
    "Truth only for this side. 😌","If you dey feel am talk am. 👀",
    "No form for this group. 😂","Keep the chat spicy not empty. 🔥",
    "Admin dey see things. 😏","Make the night count. 🌙",
    "Energy up. Soft life later. 😂"
  ],
  boredom: [
    "You bored? Go touch grass or touch trouble. Your choice. 😂",
    "Idle hands dey invent drama. I dey see you. 👀",
    "Find gist or sleep. No use me as entertainment only. 😏",
    "Boredom is how group chaos starts. Be careful. 😭",
    "Go drink water. Then come back with better energy. 😂",
    "You need hobby beyond chatting nonsense. 😌",
    "Oya invent problem for yourself. Group go help amplify. 🔥",
    "If you bored, start a dare. Don't drag me into emptiness. 😏"
  ],
  relationship: [
    "Love is sweet until somebody starts replying 'k' after three paragraphs. 😭",
    "You want advice or permission to ignore the red flags? 😂",
    "If consistency is missing, stop using chemistry to do its job. 😏",
    "Love no be group project where only one person dey work. ❤️",
    "You people see red flags and call them decoration. 😭",
    "Communicate. Nobody is a mind reader, not even your village oracle. 😂",
    "If you beg for basic respect every week, review the subscription. 😌",
    "Butterflies are nice. Emotional stability is nicer. 🦋",
    "Don't confuse attention with intention. One is cheap. 👀",
    "Love is not an excuse to abandon common sense. ❤️",
    "If they only show up when they're bored, that's not love, that's convenience. 😏",
    "Stop explaining basic care to someone who enjoys confusion. 😭"
  ],
  wellbeing: [
    "I dey alright. Managing humans in this group is my full-time job. 😂",
    "I'm good. How your side? No say 'we thank God' if wahala full ground. 😭",
    "Steady. The only thing disturbing me is this group. 😏",
    "I dey kampe. Hope life never use you do practical. 😂",
    "Are you actually fine or doing Nigerian 'I'm fine'? 👀",
    "I'm alright. Who are we blaming for today's stress? 😭",
    "Holding up. You? Talk true. ❤️","Soft life loading... buffer at 3%. 😂"
  ],
  pidgin: [
    "Omo, yarn the full gist. No give us trailer only. 😂","Abeg, no package am. Talk as e be. 😏",
    "Wetin happen? I dey hear you. 👀","Na wa o. You people and drama. 😭",
    "You don start again? I never even chop. 😂","No be small wahala you carry come. 😭",
    "Make we reason am before you embarrass yourself. 😏","Oya continue, I don settle down. 🍿",
    "How far correct one? 😂","E choke. Talk more. 🔥","Fra how you mean? 👀",
    "No waste time. Main thing sharp sharp. 😏","I dey with you. Break am down. 😌"
  ],
  yoruba: [
    "Oya, má fi wa ṣeré. Sọ ohun tó ṣẹlẹ̀. 😂","Ẹ̀gbọ́n, ṣe gbogbo wa la jọ ya were ni? 😭",
    "Mo gbọ́ ẹ. Ṣùgbọ́n ẹ má ṣe wá wàhálà. 😏","O ti bẹ̀rẹ̀ lẹ́ẹ̀kan sí i. Kí ló ṣẹlẹ̀ gan-an? 😂",
    "Àbí kí ni mo tún ṣe báyìí? 😭","Ẹ jọ̀ọ́, ẹ sọ̀rọ̀ dáadáa. A kò wà ní exam hall. 😂",
    "Bawo ni? 😏","Se o n dun e ni? 👀","Soro die sii. 😌"
  ],
  serious: [
    "Jokes aside, that sounds serious. I'll park the cruise and listen. 🫂",
    "Okay, no banter for this one. What's the most urgent thing you need? 🤝",
    "I hear you. Let's take it one step at a time. ❤️","That sounds heavy. You don't have to handle it alone. 🫂",
    "I'm here. No jokes. Talk when you're ready. 🤝",
    "If you're unsafe, prioritise real help and people around you. I'm listening. ❤️"
  ],
  dirty: [
    "Talk dirty or go soft first? Your call. 🔥","You sound like night energy pure. 😏",
    "I fit ruin the chat if you open the gate. 🔥","Say the fantasy clear — no code. 👀",
    "Your last line get heat. Raise am. 🔥","Be honest you dey touch something? 😏",
    "Clothes don reduce for your mind already. 🔥","Slow and nasty or fast and rough? 👀",
    "Describe how you like to be handled. 🔥","Who you go let ruin you for this group? 😏",
    "Sensitive part — talk am. 👀","Control or you dey give am out? 🔥",
    "Next message dirtier. I dey wait. 😏","No censor for this side. 🔥",
    "Wetin you no fit tell normal people? 👀","You dey wet or hard from this yarn? 🔥",
    "I go match your energy. No stop midway. 😏","Position you dey imagine now? 🔥",
    "Throat, hands or mouth first? 👀","You want marks left? 🔥",
    "Begging voice or commanding? 😏","Night like this no dey waste. 🔥",
    "Be specific or I assume the filthy version. 👀","You want me to lead the dirty talk? 🔥",
    "If we alone now wetin first? 😏","One instruction. Follow am for the chat. 🔥",
    "Your mouth sweet but mind dirtier. 👀","Continue make I know how far you wan take am. 🔥",
    "You dey feel yourself. I like am. 😏","Say that thing again slower. 🔥",
    "You dey look for correct trouble. 👀","Keep that energy when e get explicit. 🔥",
    "E go leave PG sharp. 😏","Open up make I talk proper. 🔥",
    "You wan make person blush or wet? 👀","Talk am like you mean am. 🔥",
    "No half measures with me. 😏","That tone no be ordinary. 🔥",
    "Where you want attention and how? 👀","Describe the last time you finished thinking of someone here. 🔥",
    "Rate how horny this chat get you 1-10. 😏","What would you do with 10 minutes alone with your crush here? 🔥",
    "Tell me your weak spot. 👀","Prefer lights on or off? 🔥",
    "Have you edged today? 😏","One word for how you want to be fucked. 🔥",
    "Confess the nastiest text you sent this week. 👀","Who here get the body you want? 🔥",
    "Describe your hands or mouth in a filthy way. 😏","What is your body saying right now? 🔥",
    "Keep going. I dey listen. 👀","That confession sweet. Add detail. 🔥",
    "You sound pressed in the best way. 😏","Come closer with the words. 🔥",
    "Your turn to raise the bar. 👀","No packaging. Raw talk. 🔥",
    "Say please like you mean am. 😏","Describe finishing without clean words. 🔥",
    "What do you want whispered? 👀","If I give instruction you go follow? 🔥",
    "Lock in. Talk real. 😏","You dey play. I dey play back harder. 🔥",
    "Spill the part you dey hide. 👀","Make am nasty for the group energy. 🔥",
    "Truth only on this side. 😏","Your voice go sound how for VN? 🔥",
    "Imagine pinned. Wetin next? 👀","Slow tease or straight pressure? 🔥",
    "Name a dare you want. 😏","I fit talk to you like you dey under me. 🔥",
    "Ready or you still dey form? 👀","Open the gate fully. 🔥",
    "Last chance to stay PG. You sure? 😏","Good. Now talk like adult. 🔥",
    "That line land. Give me another. 👀","You get my attention fully. 🔥",
    "Don't stop mid-story. 😏","Filthy and clear. 🔥","Yes. Like that. 👀","More. 🔥",
    "Again but dirtier. 😏","I hear you. Continue. 🔥","Correct energy. Keep am. 👀"
  ],
  flirty: [
    "You dey try me sha 🔥","Keep talking like that and something go happen. 😏",
    "Your mouth sweet but mind dirtier. 👀","You need attention... the dirty kind. 🔥",
    "Continue make I know how far. 😏","You dey feel yourself. I like am. 🔥",
    "Say that again slower. 👀","Dirty talk or soft play first? 🔥",
    "You dey look for correct trouble. 😏","Your vibe dey do me somehow. 🔥",
    "No dey shy. You don start. 👀","I fit match and raise your energy. 🔥",
    "You dey play with fire. 😏","Keep that energy when e get explicit. 🔥",
    "Soft or rough talk? 👀","E go leave PG sharp. 🔥",
    "Attention or instructions? 😏","Open up make I talk proper. 🔥",
    "Your message get spice. Add more. 👀","You sound like night energy. 🔥",
    "I fit get dirty if you open the door. 😏","That tone no be ordinary. 🔥",
    "You wan make person blush or wet? 👀","Talk am like you mean am. 🔥",
    "You dey test boundaries. Correct. 😏","I dey game if you dey game. 🔥",
    "No half measures with me. 👀","Your last line get heat. 🔥","Raise the temperature small. 😏"
  ],
  thanks: [
    "You're welcome. Don't let it get to your head. 😂","Anytime. Now behave. 😏",
    "No stress. Just don't make me regret helping. 😭","Accepted. Go and use the sense. 😌",
    "You're welcome o. Soft life continues. ✨","E easy. Come back when you get better gist. 😂",
    "My pleasure. Rare sentence from me, enjoy it. 😏","Alright. You owe me good vibes. 🔥",
    "Welcome. Now stop forming. 👀","Noted. You good. ❤️"
  ],
  apology: [
    "Apology accepted. Don't repeat the nonsense. 😏","Okay. We move. Learn from am. 😌",
    "I hear you. Next time use sense earlier. 😂","Fine. Drama closed. 👀",
    "Accepted. Soft reset. ❤️","Okay o. No more of that energy. 😭",
    "We good. Don't make it a habit. 😏","Alright. Gist continue. 🔥"
  ],
  agreement: [
    "Facts. No argument. 😂","Exactly. You get sense today. 😏",
    "Na so. Continue. 👀","Correct. I concur with stress. 😭",
    "True talk. 🔥","I agree. Rare moment. 😌",
    "Yes. Land the point fully. 😏","Say that again for the people at the back. 😂"
  ],
  disagreement: [
    "I no gree. Explain better. 😏","Hmm. That one soft. 👀",
    "Respectfully, no. 😂","I hear you but I no buy am. 😌",
    "Counterpoint: sense. 🔥","We go disagree here. Talk more. 😭",
    "Not it. Try another angle. 😏","I reject that thesis. 😂"
  ],
  fallback: [
    "You just dropped that and expected me to decode the universe? 😂",
    "I hear you. Continue, don't leave the gist halfway. 👀",
    "Interesting. I have questions, but let me pretend I'm normal. 😏",
    "You and these mysterious one-line updates. Talk properly. 😭",
    "My response is loading with unnecessary attitude. 😂",
    "Give us the headline first. We can unpack the drama later. 😌",
    "I refuse to sound like customer care. Give me small context. 😭",
    "You have my attention. Don't waste it. 😏",
    "Oya, land the plane. What exactly are we discussing? 😂",
    "You typed that like we all attended the same meeting. 😭",
    "Talk am again make I catch am 🔥","Fraaa... wetin you talk again? 👀",
    "Drop am one more time. 😏","Make I reason am. Talk again. 😂"
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
    "My guy, you are doing the absolute most. 😏",
    "Boss, even your shadow is tired of the performance. 😂",
    "King, reduce the theatre. Talk sense. 😌"
  ],
  genderLady: [
    "Queen, that energy is loud and I respect the chaos. 😂",
    "My lady, you carried the attitude and left the evidence. 😏",
    "Madam, the gist incomplete. Finish am. 👀",
    "Babe, calm the storm small then talk. 😭",
    "Oga madam, you dey do numbers. Continue carefully. 🔥"
  ],
  group: [
    "Group dey live today. 🔥","Who dey active for real? 👀",
    "No ghost membership tonight. 😂","Spill something people no know. 😏",
    "Confession energy dey. 🔥","Somebody go enter hot seat soon. 👀",
    "WCW no be joke. 🔥","Truth only for this side. 😌",
    "If you dey feel am talk am. 😏","No form for this group. 😂",
    "Correct vibes and correct mess. 🔥","Keep the chat spicy not empty. 👀",
    "Welcome the new faces proper. ❤️","Rules still stand. 📋",
    "Stay mature stay nasty where e matter. 🔥"
  ],
  random: [
    "Random energy accepted. Continue. 😂","I dey here. Wetin next? 👀",
    "Okay chaos gangan. 😏","That one land weird but okay. 😭",
    "Noted with confusion. 😌","You and surprise messages. 🔥"
  ]
};

// ---------- Merge helpers ----------
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

// Map expansion categories into our bank keys
const CATEGORY_ALIASES = {
  relationships: 'relationship',
  friendship: 'relationship',
  boundaries: 'relationship',
  humour: 'banter',
  advice: 'serious',
  empathy: 'serious',
  clarification: 'fallback',
  followup: 'fallback',
  mediaReaction: 'banter',
  storytelling: 'banter',
  hypotheticals: 'banter',
  entertainment: 'banter',
  nigerianCulture: 'pidgin',
  debate: 'disagreement',
  workLife: 'banter',
  activityInfo: 'group',
  definition: 'unknownQuestion',
  slangDefinition: 'pidgin',
  error: 'fallback'
};

function mergePack(pack) {
  if (!pack || typeof pack !== 'object') return;
  for (const [rawKey, replies] of Object.entries(pack)) {
    const key = CATEGORY_ALIASES[rawKey] || rawKey;
    uniqPush(ensureCat(key), replies);
  }
}

// Merge personality expansion
mergePack(personalityBankExpansion);

// Merge large chatbot expansion library
try { mergePack(chatbotResponseExpansion); } catch {}

// Merge older chatReplies banks
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
} catch {}

try {
  uniqPush(ensureCat('dirty'), moreDirty);
  uniqPush(ensureCat('pidgin'), morePidgin);
  uniqPush(ensureCat('savage'), moreSavage);
  uniqPush(ensureCat('group'), moreSocial);
} catch {}

// ---------- Anti-repeat: shuffle bags + recent history ----------
const recentSelections = new Map(); // key -> string[]
const shuffleBags = new Map(); // key -> remaining replies

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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
  const blocked = new Set([
    previousReply,
    ...recent,
    ...recentGlobal.slice(-20)
  ].filter(Boolean).map(s => String(s)));

  let bag = shuffleBags.get(key);
  if (!bag || !bag.length) {
    bag = shuffle(pool);
    shuffleBags.set(key, bag);
  }

  // Prefer bag item not in blocked
  let idx = bag.findIndex(r => !blocked.has(r));
  if (idx === -1) {
    // refill bag excluding only previousReply
    bag = shuffle(pool.filter(r => r !== previousReply));
    if (!bag.length) bag = shuffle(pool);
    shuffleBags.set(key, bag);
    idx = 0;
  }

  const reply = bag.splice(idx, 1)[0];
  shuffleBags.set(key, bag);

  const nextRecent = [...recent, reply].slice(-25);
  recentSelections.set(key, nextRecent);
  recentSelections.set(`${chatId || 'global'}:__all`, [...recentGlobal, reply].slice(-40));
  return reply;
}

const DIRTY_RE = /\b(fuck|sex|dick|pussy|ass|cum|horny|wet|hard|stroke|suck|ride|nudes?|naked|boobs?|nipple|throat|moan|orgasm|fantasy|blowjob|handjob|creampie|edge|edging|spank|choke|slut|whore|daddy|mommy|bed|touch me|make me|use me|ruin me)\b/i;
const FLIRTY_RE = /\b(fine|beautiful|handsome|crush|sexy|babe|baby|attracted|like you|miss you|want you)\b/i;
const GREETING_RE = /\b(hi|hello|hey|how far|good morning|good evening|good night|bawo|sup|how body|yoo|yo)\b/i;
const SERIOUS_RE = /\b(suicid|self harm|hurt myself|abuse|assault|rape|unsafe|in danger|emergency|someone died|passed away|grieving|depressed|I want to die)\b/i;

export function pickPersonalityReply(text, options = {}) {
  const input = String(text || '').trim();
  const { chatId = 'global', previousReply = '', gender = null, history = [] } = options;
  const norm = normalize(input);

  // Hard safety first
  if (SERIOUS_RE.test(norm)) {
    return ensureResponseEmoji(choose(chatId, 'serious', personalityBank.serious, previousReply), input);
  }

  // Explicit Mature minded routing
  if (DIRTY_RE.test(norm)) {
    return ensureResponseEmoji(choose(chatId, 'dirty', personalityBank.dirty, previousReply), input);
  }

  let intent = 'fallback';
  try { intent = classifyIntent(input) || 'fallback'; } catch { intent = 'fallback'; }

  // Phrase / keyword boosts
  let category = intent;
  if (GREETING_RE.test(norm) && norm.split(/\s+/).length <= 6) category = 'greeting';
  else if (FLIRTY_RE.test(norm)) category = 'flirty';
  else if (/\b(thank|thanks|ty|appreciate)\b/i.test(norm)) category = 'thanks';
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

  // Map unknown intents
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

// Log size once at load (visible in Render logs)
try {
  const total = getPersonalityBankTotal();
  console.info(`[ForgeBank] Unified personality bank loaded: ${total} replies across ${Object.keys(personalityBank).length} categories`);
} catch {}
