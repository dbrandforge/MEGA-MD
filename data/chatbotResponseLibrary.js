import { responseExpansion } from './chatbotResponseExpansion.js';

// Legacy curated knowledge bank. Live conversation responses are selected by the deterministic personality bank.

export const responseLibrary = {
  definition: [
    "Love is a deep feeling of care, respect, affection and commitment. It is more than attraction; it shows in how people treat one another. ❤️",
    "Friendship is a relationship built on trust, mutual care, honesty and showing up for each other. 🤝",
    "A relationship is a connection between people, shaped by communication, trust, respect and shared responsibility. ❤️",
    "Emotional intelligence is the ability to recognise, understand and manage your emotions while responding thoughtfully to other people's feelings. 🧠",
    "Self-respect means recognising your worth and maintaining standards for how you allow others to treat you. 💯"
  ],
  slangDefinition: [
    "“Fra” is informal slang for “for real”. People use it to show they are serious, agree strongly or want to emphasise a point. 😄",
    "“No cap” means no lie or genuinely telling the truth. 🧢",
    "“Bet” is a casual way to say okay, agreed or sounds good. 🤝",
    "“Lowkey” means quietly, subtly or to some extent, without making it too obvious. 👀",
    "“FR” is short for “for real” — basically, seriously or honestly. 😄"
  ],
  financialNeed: [
    "Let's make this practical: how much do you need, and by when? We can look at realistic ways to raise it without making the situation worse. 💡",
    "First, pin down the amount and deadline. Then check immediate options: a paid task, a short-term gig, selling something you no longer need, or asking someone you trust for a clearly agreed loan. 🤝",
    "I hear you. If it's urgent, focus on the exact amount needed and the deadline. Avoid anyone promising instant money in exchange for upfront fees or your bank details. ⚠️",
    "Money matter needs a plan, not motivational quotes 😂 How much are you trying to raise, and what is the deadline?",
    "Let's identify what you can do today: follow up on money owed, offer a skill or service for quick payment, or negotiate more time on the expense. What amount are we talking about? 💰",
    "No judgement. Tell me the amount and how soon you need it; I'll help you map out practical options that fit the situation. 🤝"
  ],
  error: [
    "Error where? Send the exact message or tell me what failed; make we trace am. 🛠️",
    "Which part is showing error? Give me the details so I can help you sort it. 🔧",
    "I hear you. What exactly went wrong? No need to start from the beginning if you can show the error. 👀"
  ],
  activityInfo: [
    "I don't have today's group activity schedule available yet. If an admin shares it here, I'll help keep everyone updated. 📅",
    "No confirmed activity has been shared with me for today. Make una suggest something interesting. 👀"
  ],
  greeting: [
    "How far? You don land 😄",
    "I dey here. Wetin dey happen?",
    "Good to see you. How body?",
    "Oya, give us the update.",
    "You don show face. Talk to us.",
    "Bawo ni? Mo n gbo e.",
    "What’s good with you today?",
    "I dey alright. How your side?",
    "Welcome back. We dey wait for gist.",
    "You good? Make we hear you."
  ],
  wellbeing: [
    "I dey alright, just observing the drama in this group 😂 You nko?",
    "No complaints for now. How your day dey go?",
    "I'm good. Just keeping my eyes on this group.",
    "Body dey okay. Mind dey alert. Wetin sup?",
    "I dey manage this premium chaos. You呢?",
    "All good on this side. How far with you?",
    "I'm fine, thanks for asking. What's happening with you?",
    "Steady. Hope your own side dey better?"
  ],
  clarification: [
    "Which part you want make I explain?",
    "Hold on, which exact thing confuse you?",
    "I fit explain, but point me to the part you mean.",
    "You mean my last message or the whole matter?",
    "Make we break am down. Where I lose you?",
    "No wahala. Which angle you want me to clarify?",
    "I get you. Tell me the part that isn't clear."
  ],
  followup: [
    "Because that was the point I was making. Want the longer version?",
    "I said what I said 😂 But make I explain the reasoning.",
    "You caught that part? There's more to it.",
    "Fair question. The context before that matters.",
    "Wait, are you asking why I said it or what I meant by it?",
    "That's connected to what we were discussing earlier.",
    "I can unpack that. Which part should we start with?"
  ],
  thanks: [
    "You're welcome. No stress.",
    "Anytime. We move.",
    "No wahala. Glad I could help.",
    "You don thank me finish? Bring better gist 😂",
    "Always. Anything else?",
    "I got you. No need to overdo the appreciation."
  ],
  apology: [
    "No hard feelings. We move.",
    "It's alright. Just make sure the matter no repeat.",
    "Accepted. Let's leave the issue there.",
    "No wahala. Everybody fit miss road sometimes.",
    "I hear you. Thanks for owning it.",
    "All good. Let's reset."
  ],
  agreement: [
    "Exactly. You understand the assignment.",
    "Na so. At least somebody dey reason am.",
    "I agree with that one.",
    "Correct point. No need to force argument.",
    "You get am. That's the angle.",
    "Facts. I no get anything to add."
  ],
  disagreement: [
    "I see your point, but I no fully agree.",
    "Not quite. There's another side to this.",
    "I hear you, but that conclusion is too quick.",
    "We fit disagree without turning am to war.",
    "I get the argument. The evidence is where I differ.",
    "Let's separate the facts from the assumption."
  ],
  teasing: [
    "You came prepared to cause trouble today 😂",
    "See confidence. Evidence never show but confidence full ground.",
    "You no get small setting? 😂",
    "I was going to behave, but you started this.",
    "This your mouth needs adult supervision.",
    "You like attention and you're not even hiding it."
  ],
  savage: [
    "That take needs a second opinion and maybe a restart.",
    "You said that with your full chest? Interesting.",
    "The confidence is impressive. The logic is still loading.",
    "I won't insult you. Your argument has done enough.",
    "Let's not confuse volume with sense.",
    "You brought energy. Now bring evidence."
  ],
  flirty: [
    "You dey use style catch attention. I notice.",
    "That was smooth. Don't let it enter your head.",
    "You have my attention. What next?",
    "Easy now, you dey make this conversation interesting.",
    "Is that your normal charm or special delivery?",
    "You sabi package ordinary message sha."
  ],
  empathy: [
    "That sounds heavy. You want to talk about what happened?",
    "I hear you. No pressure to explain everything at once.",
    "That's rough. I hope things get easier from here.",
    "Your feelings make sense. Take a moment if you need one.",
    "I'm listening. What part has been hardest?",
    "You no need pretend say everything dey fine."
  ],
  boredom: [
    "Then let's find something better to do. Who get gist?",
    "This group needs fresh plot. Somebody drop hot topic.",
    "Boredom don reach this level? 😂",
    "Oya, ask a question nobody here is ready for.",
    "Let's change the energy. What's one unpopular opinion you hold?",
    "Somebody should start a proper conversation before we sleep."
  ],
  random: [
    "That came out of nowhere 😂 Explain yourself.",
    "Interesting. How did we arrive here?",
    "I wasn't expecting that plot twist.",
    "You just dropped that and walked away?",
    "This conversation has taken another turn.",
    "I need context, because what exactly is happening?"
  ],
  pidgin: [
    "Abeg yarn me well, I dey hear you.",
    "No package am. Talk as e be.",
    "Wetin be the full gist?",
    "I dey follow. Continue.",
    "Omo, this matter get layers.",
    "You don open this topic, no disappear now.",
    "Na wa o. Wetin happen next?",
    "Make we reason am small."
  ],
  yoruba: [
    "Mo n gbo e. Soro.",
    "Bawo ni? Se gbogbo nkan daadaa?",
    "Ko buru. So fun mi ni detail.",
    "O ti ye mi die. Tesiwaju.",
    "Kilode? Kinni o sele?",
    "Ma binu, se o le tun so?",
    "O dara. A ma ri bi a se le se e."
  ],
  group: [
    "Everybody calm down, one person at a time 😂",
    "This group is never short of content.",
    "Who is taking responsibility for this discussion?",
    "I need the rest of the group to weigh in.",
    "Let's hear from somebody who hasn't spoken yet.",
    "This gist deserves a proper explanation."
  ],
  fallback: [
    "I dey here. Give me small context.",
    "I see the message, but what's the main point?",
    "Talk to me. Wetin you really mean?",
    "Interesting. Continue, I'm listening.",
    "I need one more clue to follow this properly.",
    "You can't drop that line and leave us hanging."
  ]
};

for (const [category, entries] of Object.entries(responseExpansion)) {
  if (!Array.isArray(responseLibrary[category])) responseLibrary[category] = [];
  responseLibrary[category].push(...entries);
}

export const intentRules = [
  // Direct informational requests must be recognised before broad topic categories.
  { intent: 'slangDefinition', patterns: [/\b(what does .{1,40} mean|what is the meaning of .{1,40}|meaning of .{1,40}|define .{1,40})\b/i] },
  { intent: 'copyrightLyrics', patterns: [/\b(lyrics|lyric)\b.*\b(song|track|music|by)\b|\b(song|track)\b.*\b(full lyrics|lyrics)\b/i] },
  { intent: 'definition', patterns: [/^\s*(what is|what are|explain)\b/i, /\b(define|definition of|meaning of)\b/i] },
  { intent: 'financialNeed', patterns: [/\b(i need money|need money|i need cash|need some cash|i need funds|need funds urgently|broke|i am broke|i'm broke|no money|out of money|how can i make money|how do i make money|what can i do to make money|how can i earn money|how do i earn money|how to make money|ways to make money|make money|raise money|urgent money|how do i get a loan|how can i get a loan|where can i get a loan|need a loan|borrow money|loan)\b/i] },
  { intent: 'error', patterns: [/^\s*(error|it'?s an error|that'?s an error|you made an error)\s*[.!?]*$/i, /\b(error message|showing an error|got an error|failed with an error)\b/i] },
  { intent: 'activityInfo', patterns: [/\b(what'?s|what is|any) (the )?(group'?s )?(activity|activities|plan|plans|agenda) (for )?(today|tonight|this evening)\b/i, /\bwhat (are we|is the group) doing (today|tonight)\b/i] },
  // Specific emotional/social intents precede broad language and generic conversation matches.
  { intent: 'disagreement', patterns: [/\b(i disagree|not true|you're wrong|you are wrong|i don't think so|i don't agree|that is incorrect)\b/i] },
  { intent: 'flirty', patterns: [/\b(flirt|flirting|you are cute|you're cute|you are fine|you're fine|i like you|i have a crush|rizz|shoot your shot)\b/i] },
  { intent: 'relationships', patterns: [/\b(relationship|relationships|dating|date|crush|boyfriend|girlfriend|partner|situationship|talking stage|breakup|break up|marriage|married|cheating|red flag|green flag|love|loving|in love|fall in love|compatible|incompatible|compatibility)\b/i] },
  { intent: 'friendship', patterns: [/\b(friendship|best friend|my friend|friends|falling out|beef with|betrayed|loyalty|fake friend)\b/i] },
  { intent: 'boundaries', patterns: [/\b(boundary|boundaries|set limits|say no|personal space|respect my|access to me)\b/i] },
  { intent: 'empathy', patterns: [/\b(i feel|i'm sad|i am sad|i'm tired|i am tired|rough day|heartbroken|stressed|depressed|anxious|overwhelmed|grieving|lost someone)\b/i] },
  { intent: 'advice', patterns: [/\b(what should i do|need advice|advise me|any advice|what do you suggest|help me decide|should i)\b/i] },
  { intent: 'workLife', patterns: [/\b(work|workplace|office|career|job|boss|colleague|client|salary|business|project|deadline|professional|volunteer|interview)\b/i] },
  { intent: 'debate', patterns: [/\b(debate|unpopular opinion|hot take|i disagree|prove that|argument|controversial|what's your opinion|what is your opinion|do you think)\b/i] },
  { intent: 'entertainment', patterns: [/\b(movie|film|series|episode|netflix|music|song|artist|album|concert|celebrity|actor|actress|football|match|show|anime|series)\b/i] },
  { intent: 'nigerianCulture', patterns: [/\b(nigeria|naija|yoruba culture|igbo culture|hausa|tradition|tribe|state of origin|jollof|amala|egusi|suya|owambe|aso ebi)\b/i] },
  { intent: 'storytelling', patterns: [/\b(let me tell you|story time|something happened|guess what happened|you won't believe|you will not believe|back in the day|one time)\b/i] },
  { intent: 'hypotheticals', patterns: [/\b(what if|imagine if|suppose|hypothetically|would you rather|if you had|if you could|choose one)\b/i] },
  { intent: 'mediaReaction', patterns: [/\b(this picture|this image|this video|this clip|look at this|see this|what do you see|caption|screenshot|meme)\b/i] },
  { intent: 'humour', patterns: [/\b(lol|lmao|😂|🤣|that is funny|that's funny|joke|comedy|crack me up)\b/i] },
  { intent: 'thanks', patterns: [/\b(thank(s| you)|appreciate it|grateful)\b/i] },
  { intent: 'apology', patterns: [/\b(sorry|my bad|apolog(y|ise|ize)|i apologise|i apologize)\b/i] },
  { intent: 'agreement', patterns: [/\b(i agree|exactly|true|facts|correct|you are right|na so)\b/i] },
  { intent: 'wellbeing', patterns: [/\bhow are you\b/i, /\bhow you dey\b/i, /\bhow body\b/i, /\bhow far\b/i, /\bhow is your day\b/i, /\b(?:came to check|checking) if (?:you are|you’re|you're|u are|u're) (?:still )?alive\b/i] },
  { intent: 'greeting', patterns: [/^\s*(hi|hello|hey|yo|good morning|good afternoon|good evening|good night)\b/i, /\bbawo ni\b/i, /\bwhat'?s (popping|good|up)\b/i] },
  { intent: 'clarification', patterns: [/\bwhat do you mean\b/i, /\bexplain\b/i, /\bclarify\b/i, /\bi don't understand\b/i, /\bwhat does that mean\b/i] },
  { intent: 'followup', patterns: [/\bwhy did you say\b/i, /\bwhy\b/i, /\bare you serious\b/i, /\bwhat happened next\b/i, /\bhow come\b/i] },
  { intent: 'boredom', patterns: [/\b(bored|boring|nothing to do|i'm idle|i am idle)\b/i] },
  { intent: 'group', patterns: [/\b(group|everybody|everyone|hot seat|truth or dare|who is online)\b/i] },
  { intent: 'yoruba', patterns: [/\b(mo n|bawo|kilode|soro|o ti|se o|o ti sun mi|ori e ti yi|ori re ti yi|o ti ya mi|toor|oloshi|egbon e|egbon mi|sebi)\b/i] },
  { intent: 'pidgin', patterns: [/\b(abeg|wetin|dey|na so|omo|yarn|wahala|e choke)\b/i, /\byou dey go (now|naw)\b/i] },
  { intent: 'teasing', patterns: [/\b(you are funny|you sef|you no get|see this one|you dey craze|you are crazy|you're crazy|you crazy|werey|wery|mumu|ode|you mad|mad bot)\b/i] }
];


/**
 * Small, high-confidence answers for recurring substantive questions.
 * Keep these narrowly scoped: unknown questions should not receive a fabricated answer.
 */
export function pickSubstantiveReply(text = '', context = []) {
  const input = String(text || '').trim();
  const recentContext = (Array.isArray(context) ? context : []).join(' ');
  const marketingContext = /\b(digital marketer|digital marketing|attract customers|marketing service)\b/i.test(recentContext);
  if (!input) return null;

  // Copyright-safe handling must win over entertainment/personality banks,
  // including short follow-ups such as "just give me the lyrics".
  const asksForLyrics = /\b(lyrics|lyric)\b/i.test(input)
    && (/\b(song|track|music|davido|artist|singer|by)\b/i.test(input)
      || /\b(lyrics|lyric)\b/i.test(recentContext));
  if (asksForLyrics) {
    return "I can't provide the full copyrighted lyrics, but I can summarise the song, explain its meaning, or discuss a short excerpt you share. 🎵";
  }

  // Clear, non-graphic sexual-health education; never infer that a definition request is flirtation.
  if (/\b(what is|define|explain)\s+(sex|sexual intercourse)\b/i.test(input)
      || (/\bsex\b/i.test(input) && /\b(different styles|types of sex|forms of sex)\b/i.test(input))) {
    return "Sex can mean biological characteristics, but in this context it usually means consensual sexual activity between people. Forms of sexual activity include vaginal sex, oral sex, anal sex, mutual masturbation and non-penetrative intimacy. Any sexual activity should involve informed, freely given consent, communication and the ability to stop at any time. Condoms and appropriate contraception can reduce STI and pregnancy risks. ❤️";
  }

  if (/\b(how can i determine|how do i know|how can i tell|signs)\b/i.test(input)
      && /\b(loves? me|in love with me|genuinely loves me)\b/i.test(input)) {
    return "Look for consistent behaviour, not one dramatic gesture: they make time for you, listen, respect your boundaries, communicate honestly, show care when it is inconvenient and take responsibility when they hurt you. Their actions should make you feel respected and emotionally safe, not constantly confused. No single sign proves love, so look at the pattern and have an honest conversation about what you both want. ❤️";
  }

  if (/\b(hairdresser|hairstylist|hair stylist|barber|salon)\b/i.test(input)
      && /\b(improve|better|skill|customers|clients|grow|business|more people)\b/i.test(input)) {
    return "Build both your craft and your client pipeline. For your skill: practise one technique at a time on models, take advanced training, study clean sectioning and finishing, improve consultation and hygiene, and photograph each result in consistent light. For customers: choose the services you want to be known for, post clear before-and-after work, show short process videos, collect client reviews, create a referral reward, keep a simple booking/WhatsApp catalogue and follow up for repeat appointments. Track which posts and referrals actually bring bookings. 💇";
  }

  if (/\b(loan|borrow)\b/i.test(input) && /\b(get|apply|where|need|want|how|borrow)\b/i.test(input)) {
    return "Start by deciding the exact amount, purpose and monthly repayment you can genuinely afford. Compare a bank or regulated microfinance lender with other legitimate options; check the total repayment, interest, fees, late charges and due dates in writing before accepting. Verify the lender's current authorisation through the relevant Nigerian regulator's official information. Avoid lenders demanding an upfront release fee, your PIN or OTP, or access to your contacts. If the repayment would consume money needed for essentials, do not take the loan yet. What amount do you need, and what income can repay it? 💡";
  }

  // Narrow, verified answers for common identity/current-affairs questions.
  if (/\btatiana(?:\s+manaois)?\b/i.test(input)) {
    if (/\b(song|love song|romantic|recommend|recommendation)\b/i.test(input)) {
      return "Yes — Tatiana Manaois is a singer-songwriter. For a romantic track, try *Helplessly*; *Loved Like This* is another good option. 🎶";
    }
    return "Yes. Tatiana Manaois is an independent singer-songwriter known for melodic pop and acoustic-influenced songs. One of her well-known tracks is *Helplessly*. 🎶";
  }

  if (marketingContext && /\b(content|contents|post|posts|create|creating|what should i share)\b/i.test(input)) {
    return "For your digital marketing work, create five repeatable content types: educational posts that solve one customer problem, short how-to videos, case studies showing a result, client testimonials or proof, and offer-focused posts explaining who you help and how to buy. For the next week, publish 2 educational posts, 2 short videos, 1 case study, 1 proof post and 1 direct offer. Keep each post aimed at one target customer and track enquiries and qualified leads—not likes alone.";
  }

  if (/\b(digital marketer|digital marketing)\b/i.test(input) &&
      /\b(attract|customers|clients|content|contents|what should i post|what can i post)\b/i.test(input)) {
    if (/\b(content|contents|post|create|creating)\b/i.test(input)) {
      return "Start with five content types: (1) educational posts that solve one customer problem, (2) short how-to videos, (3) case studies showing a result, (4) client testimonials and proof, and (5) offer-focused posts explaining who you help and how to buy. Use one clear audience and one service as your focus. For the next 7 days, publish 2 educational posts, 2 short videos, 1 case study, 1 proof/testimonial post and 1 direct offer. Track enquiries, saves and qualified leads—not likes alone.";
    }
    return "Choose one audience and one clear service first. Show proof of your work, explain the problem you solve, publish useful content consistently, engage with people who fit your target market, and make the next step obvious with a clear offer or call to action. Start conversations with potential customers instead of relying on posts alone, and measure qualified leads rather than likes.";
  }

  if (/\b(can|could|do)\b.*\b(two people|people|couple|partners)\b.*\b(love|care about each other)\b.*\b(incompatible|not compatible|compatibility)\b/i.test(input)
      || /\b(can|could)\b.*\b(love each other)\b.*\b(incompatible|not compatible)\b/i.test(input)
      || /\b(can|could)\b.*\b(love)\b.*\b(incompatible|not compatible)\b/i.test(input)) {
    return "Yes. Two people can genuinely love each other and still be incompatible. Love is about care and attachment; compatibility is about whether their values, needs, communication styles, life goals and ways of handling conflict can work together. They may care deeply and still struggle to build a healthy life together. The useful question is not only whether love exists, but whether the relationship allows both people to feel respected, secure and able to be themselves. ❤️";
  }

  if (/\bhow (can|do) i fall in love\b/i.test(input)
      || /\bhow to fall in love\b/i.test(input)
      || /\bhow can someone fall in love\b/i.test(input)) {
    return "You cannot force yourself to fall in love, but you can make room for it. Spend time with people you genuinely enjoy, stay curious about who they are, share honest experiences, and let trust and affection develop gradually. Pay attention to consistency, respect, emotional safety and shared values—not just chemistry or the idea of being in love. And do not rush yourself; a real connection should be mutual. ❤️";
  }

  if (/\b(what can i do to make money|how can i make money|how do i make money|how can i earn money|how do i earn money|how to make money|ways to make money)\b/i.test(input)) {
    return "Start with something people already pay for, not just a vague business idea. You could sell a service you can deliver now—design, writing, editing, tutoring, repairs, admin support or social media help; resell a product with proven demand; take paid shifts or commission-based sales; or teach a skill. Pick one offer, define who needs it and the result you will deliver, set a clear price, then speak to 10 likely customers before spending heavily. Avoid opportunities that demand upfront fees or your bank details or OTP. Tell me your skills, available hours and starting budget, and I can help narrow this to realistic options. 💡";
  }

  return null;
}

export function getQuestionFallback(text = '') {
  const input = String(text || '').trim();
  const words = input.split(/\s+/).filter(Boolean);
  if (words.length < 5 || !/\?\s*$/.test(input)) return null;
  return "I want to give you an answer that actually addresses the question, not throw a random line at you. I don't have a reliable answer ready for this one yet. Try narrowing down the part you want to understand, and I'll follow that angle.";
}

export function classifyIntent(text = '') {
  const input = String(text).trim();
  for (const rule of intentRules) {
    if (rule.patterns.some(pattern => pattern.test(input))) return rule.intent;
  }
  return 'fallback';
}

// Return curated examples to ground the AI in the response bank on every turn.
// The AI adapts these examples to context; they are not forced verbatim outputs.
export function getIntentExamples(text = '', limit = 4) {
  const intent = classifyIntent(text);
  const replies = responseLibrary[intent] || responseLibrary.fallback;
  if (!replies.length) return [];
  const selected = [];
  const start = Math.floor(Math.random() * replies.length);
  for (let i = 0; i < Math.min(limit, replies.length); i++) {
    selected.push(replies[(start + i) % replies.length]);
  }
  return selected;
}

export function getResponseEmoji(text = '', intent = classifyIntent(text)) {
  const emojiByIntent = {
    greeting: ['👋', '😄'], wellbeing: ['😊', '🤗'], teasing: ['😂', '😏'],
    savage: ['😌', '😂'], flirty: ['😉', '❤️'], empathy: ['🫂', '❤️'],
    advice: ['💡', '🤝'], debate: ['🧐', '⚖️'], disagreement: ['🤝', '🧐'],
    definition: ['💡', '🧠'], slangDefinition: ['😄', '💬'],
    activityInfo: ['📅', '👀'], error: ['🛠️', '🔧'], thanks: ['🤝', '😊'], apology: ['🤝', '❤️'],
    agreement: ['💯', '🤝'], pidgin: ['😂', '😄'], yoruba: ['😊', '🤝'],
    boredom: ['👀', '😂'], group: ['😂', '👥']
  };
  const choices = emojiByIntent[intent] || ['😄', '💬'];
  return choices[Math.floor(Math.random() * choices.length)];
}

export function ensureResponseEmoji(reply = '', text = '') {
  const value = String(reply).trim();
  if (!value) return value;
  // Preserve an emoji already used naturally in the response.
  if (/\p{Extended_Pictographic}/u.test(value)) return value;
  return `${value} ${getResponseEmoji(text)}`;
}

export function pickLibraryReply(text = '', previousReply = '') {
  const intent = classifyIntent(text);
  if (intent === 'fallback' || intent === 'copyrightLyrics') return null;
  const input = String(text || '').trim();
  const isDirectQuestion = /[?]\s*$/.test(input)
    || /^(who|whom|whose|what|what's|when|where|why|how|which|who's)\b/i.test(input);
  // Topic banks contain conversation starters, not verified factual answers.
  // Never let one replace an answer to a direct question.
  if (isDirectQuestion && !['definition', 'slangDefinition', 'activityInfo'].includes(intent)) return null;
  let replies = responseLibrary[intent];
  if (!Array.isArray(replies) || !replies.length) return null;

  // Knowledge presets must match the requested term; never return a random definition.
  const normalizedInput = input.toLowerCase();
  if (intent === 'definition') {
    const termRules = [
      [/\blove\b/, 0], [/\bfriendship\b/, 1], [/\brelationship\b/, 2],
      [/\bemotional intelligence\b/, 3], [/\bself[- ]respect\b/, 4]
    ];
    const match = termRules.find(([pattern]) => pattern.test(normalizedInput));
    if (!match) return null;
    replies = [replies[match[1]]].filter(Boolean);
  }
  if (intent === 'slangDefinition') {
    const slangRules = [
      [/\bfra\b|\bfr\b/, 0], [/\bno cap\b/, 1],
      [/\bbet\b/, 2], [/\blowkey\b/, 3]
    ];
    const match = slangRules.find(([pattern]) => pattern.test(normalizedInput));
    if (!match) return null;
    replies = [replies[match[1]]].filter(Boolean);
  }
  const alternatives = replies.filter(reply => reply !== previousReply);
  const pool = alternatives.length ? alternatives : replies;
  return ensureResponseEmoji(pool[Math.floor(Math.random() * pool.length)], text);
}

export function pickFallbackReply(previousReply = '') {
  const replies = responseLibrary.fallback || [];
  const alternatives = replies.filter(reply => reply !== previousReply);
  const pool = alternatives.length ? alternatives : replies;
  if (!pool.length) return ensureResponseEmoji("I'm here. Give me a little more to work with.", '');
  return ensureResponseEmoji(pool[Math.floor(Math.random() * pool.length)], '');
}

export function getResponseLibraryStats() {
  const categories = Object.entries(responseLibrary).map(([category, replies]) => ({
    category,
    count: replies.length
  }));
  return {
    categories,
    total: categories.reduce((sum, item) => sum + item.count, 0)
  };
}
