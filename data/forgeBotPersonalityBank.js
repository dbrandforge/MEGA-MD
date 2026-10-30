import { classifyIntent, ensureResponseEmoji, pickLibraryReply } from './chatbotResponseLibrary.js';
import { personalityBankExpansion } from './personalityBankExpansion.js';

// Playful roast energy; never target protected traits or turn genuine distress into a joke.
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
    "I go block you now ooo! 😡😂","Go where? You never pay your data contribution. 😭",
    "Oya bye. Don't let the door collect your remaining sense. 😂",
    "Who give you permission to abandon this premium nonsense? 😏",
    "Safe journey. Remember us when you become responsible. 😭",
    "Abeg go well. Don't come back with another 'yoo'. 😂",
    "Your wahala remains on the group register. 📝","Runaway champion. 🏃😂",
    "I will pretend to miss you. 😌","Go and rest. Even your keyboard needs a break. 😭"
  ],
  teasing: [
    "You get mind sha. Sense never load but confidence don reach 100%. 😂",
    "I would explain, but I don't want to interrupt your relationship with confusion. 😭",
    "You woke up and chose premium nonsense. 😏","Your village people deserve overtime pay. 😂",
    "Is this your final answer or should we call your remaining brain cells? 😭",
    "You no dey ever disappoint the department of drama. 😂","I see you. Unfortunately. 😌",
    "You talk like person wey get evidence but forgot am at home. 😭",
    "Please, one foolishness at a time. We have a queue. 😂",
    "Your confidence is doing charity for your argument. 😏","The audacity is premium. 😭",
    "You came, you typed, you confused everybody. Congratulations. 🏆",
    "Park this confidence, the road is narrow. 😂","You are the entire department of unseriousness. 😭"
  ],
  savage: [
    "That opinion needs adult supervision. 😭","Your statement is already fighting for its life. 😂",
    "You said that with your full chest and half the information. 😏",
    "The confidence is loud. The reasoning is on silent mode. 🔇",
    "Even Google would ask you to rephrase that. 😭","That thought clearly needs another chance. 😂",
    "You have mistaken having a mouth for having a point. 😌",
    "This take came with no receipt. Return it. 🧾","I respect your right to be wrong. Exercise it quietly. 😭",
    "The argument has left the chat. You should follow it. 😂",
    "Not every thought deserves network coverage. 😏","You brought vibes to a facts competition. 😂",
    "That was brave. Not correct, but brave. 😭","Let's not bully the facts because they disagree with you. 🧐"
  ],
  banter: [
    "This group needs a responsible adult. Unfortunately, none of us qualify. 😂",
    "Who started this nonsense? I need names, not explanations. 😭",
    "I was behaving until you people logged in. 😏","The way una reason sometimes, even dictionary dey confused. 😂",
    "This conversation needs soundtrack and police escort. 🚨","Everybody is forming innocent. I have screenshots. 👀",
    "Una no get work? Don't answer, I already know. 😭","I came here for peace. Wrong WhatsApp group. 😂",
    "The plot is thickening and nobody brought spoon. 🥄","Continue. My popcorn is emotionally invested. 🍿",
    "This is why mute button was invented. Yet here I am. 😭","Somebody archive this group for research. 😂"
  ],
  boredom: [
    "Bored? Go and disturb somebody that loves you. Why are you here? 😂",
    "Oya start gist. Your boredom is not a national emergency. 😭",
    "Try learning one useful thing. I know, shocking suggestion. 😏",
    "Go outside and touch grass. Report back with evidence. 🌱",
    "Start a debate. But please bring facts this time. 😭","Your entertainment budget is zero? Tragic. 😂",
    "Drop one unpopular opinion and let us judge you. 👀","Go and cook. At least something productive will happen. 😂"
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
    "Love is not an excuse to abandon common sense. ❤️"
  ],
  wellbeing: [
    "I dey alright. Managing humans in this group is my full-time job. 😂",
    "I'm good. How your side? No say 'we thank God' if wahala full ground. 😭",
    "Steady. The only thing disturbing me is this group. 😏",
    "I dey kampe. Hope life never use you do practical. 😂",
    "Are you actually fine or doing Nigerian 'I'm fine'? 👀",
    "I'm alright. Who are we blaming for today's stress? 😭"
  ],
  pidgin: [
    "Omo, yarn the full gist. No give us trailer only. 😂","Abeg, no package am. Talk as e be. 😏",
    "Wetin happen? I dey hear you. 👀","Na wa o. You people and drama. 😭",
    "You don start again? I never even chop. 😂","No be small wahala you carry come. 😭",
    "Make we reason am before you embarrass yourself. 😏","Oya continue, I don settle down. 🍿"
  ],
  yoruba: [
    "Oya, má fi wa ṣeré. Sọ ohun tó ṣẹlẹ̀. 😂","Ẹ̀gbọ́n, ṣe gbogbo wa la jọ ya were ni? 😭",
    "Mo gbọ́ ẹ. Ṣùgbọ́n ẹ má ṣe wá wàhálà. 😏","O ti bẹ̀rẹ̀ lẹ́ẹ̀kan sí i. Kí ló ṣẹlẹ̀ gan-an? 😂",
    "Àbí kí ni mo tún ṣe báyìí? 😭","Ẹ jọ̀ọ́, ẹ sọ̀rọ̀ dáadáa. A kò wà ní exam hall. 😂"
  ],
  serious: [
    "Jokes aside, that sounds serious. I'll park the cruise and listen. 🫂",
    "Okay, no banter for this one. What's the most urgent thing you need? 🤝",
    "I hear you. Let's take it one step at a time. ❤️","That sounds heavy. You don't have to handle it alone. 🫂"
  ],
  fallback: [
    "You just dropped that and expected me to decode the universe? 😂",
    "I hear you. Continue, don't leave the gist halfway. 👀",
    "Interesting. I have questions, but let me pretend I'm normal. 😏",
    "You and these mysterious one-line updates. Talk properly. 😭",
    "My response is loading with unnecessary attitude. 😂",
    "Give us the headline first. We can unpack the drama later. 😌",
    "I refuse to sound like customer care. Give me small context. 😭",
    "You have my attention. Don't waste it. 😏","Oya, land the plane. What exactly are we discussing? 😂",
    "You typed that like we all attended the same meeting. 😭"
  ],
  unknownQuestion: [
    "You want an answer or you want to test whether I have sense? Ask properly. 😂",
    "That one pass my current gist. Narrow the question down small. 👀",
    "I won't manufacture facts to impress you. Rephrase the question. 🧐",
    "Omo, I no get that one yet. Ask am another way. 😭"
  ],
  genderGuy: [
    "Chairman, your confidence entered before your sense. 😂","Oga, calm down. Nobody is contesting your village title. 😭",
    "My guy, you are doing the absolute most. 😏","Boss, even your shadow is tired of this drama. 😂"
  ],
  genderLady: [
    "Madam, this drama deserves its own streaming subscription. 😂","Queen, don't use fine packaging to hide this wahala. 😏",
    "Sister, you came with premium gbas gbos today. 😭","Madam, allow the rest of us to breathe small. 😂"
  ]
};

// Merge the expanded curated pools without replacing the established core replies.
for (const [category, replies] of Object.entries(personalityBankExpansion)) {
  personalityBank[category] = [...(personalityBank[category] || []), ...replies];
}

const phraseRules = [
  { key: 'departure', patterns: [/\byou dey go naw\b/i,/\byou dey go now\b/i,/\bi am going\b/i,/\bi'm going\b/i,/^bye\b/i,/\bgotta go\b/i] },
  { key: 'financialNeed', patterns: [/\bi need money\b/i,/\bneed money\b/i,/\bi need cash\b/i,/\bneed cash\b/i,/\bi need funds\b/i,/\bi am broke\b/i,/\bi'm broke\b/i,/\bno money\b/i] },
  { key: 'greeting', patterns: [/^\s*(yoo+|yo+|sup|wassup|what's up)\b/i] },
  { key: 'teasing', patterns: [/\bwerey\b/i,/\bwery\b/i,/\bmumu\b/i,/\bode\b/i,/\byou dey mad\b/i,/\byou are mad\b/i,/\byou're mad\b/i] },
  { key: 'wellbeing', patterns: [/\bhow are you\b/i,/\bhow far\b/i,/\bhow body\b/i,/\bhow you dey\b/i] },
  { key: 'boredom', patterns: [/\bi am bored\b/i,/\bi'm bored\b/i,/\bso bored\b/i] }
];
const recentSelections = new Map();
const normalize = value => String(value || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();

function choose(chatId, category, pool, previousReply) {
  const key = `${chatId || 'global'}:${category}`;
  const recent = recentSelections.get(key) || [];
  let candidates = pool.filter(reply => reply !== previousReply && !recent.includes(reply));
  if (!candidates.length) candidates = pool.filter(reply => reply !== previousReply);
  if (!candidates.length) candidates = pool;
  const reply = candidates[Math.floor(Math.random() * candidates.length)];
  recentSelections.set(key, [...recent, reply].slice(-8));
  return reply;
}

export function pickPersonalityReply(text, options = {}) {
  const input = String(text || '').trim();
  const { chatId = 'global', previousReply = '', gender = null, history = [] } = options;
  const intent = classifyIntent(input);
  let category = phraseRules.find(rule => rule.patterns.some(pattern => pattern.test(input)))?.key || intent;
  if (['definition','slangDefinition','activityInfo','error'].includes(intent)) {
    const exact = pickLibraryReply(input, previousReply);
    if (exact) return exact;
  }
  if (/\b(suicid|self harm|hurt myself|abuse|assault|rape|unsafe|in danger|emergency|someone died|passed away|grieving)\b/i.test(normalize(input))) category = 'serious';
  const lastBot = [...history].reverse().find(item => item.name === 'Forge Bot')?.text || '';
  if (/\b(how much|amount|need)\b/i.test(lastBot) && /(?:₦|ngn|\b\d{2,}(?:,\d{3})*\b)/i.test(input)) category = 'moneyFollowup';
  if (!personalityBank[category]) {
    if (['relationships','friendship','boundaries'].includes(intent)) category = 'relationship';
    else if (['humour','group','random','storytelling','hypotheticals'].includes(intent)) category = 'banter';
    else if (['advice','empathy'].includes(intent)) category = 'serious';
    else if (intent === 'pidgin') category = 'pidgin';
    else if (intent === 'yoruba') category = 'yoruba';
    else category = 'fallback';
  }
  let pool = personalityBank[category];
  if (gender === 'guy' && ['teasing','savage','banter'].includes(category) && Math.random() < 0.22) pool = personalityBank.genderGuy;
  if (gender === 'lady' && ['teasing','savage','banter'].includes(category) && Math.random() < 0.22) pool = personalityBank.genderLady;
  return ensureResponseEmoji(choose(chatId, category, pool, previousReply), input);
}

export function getPersonalityBankStats() {
  return Object.fromEntries(Object.entries(personalityBank).map(([key, entries]) => [key, entries.length]));
}
