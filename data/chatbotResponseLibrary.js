import { responseExpansion } from './chatbotResponseExpansion.js';

// Structured fallback response library for Forge Bot.
// Keep entries conversational, distinct, and category-specific. AI remains the primary responder.

export const responseLibrary = {
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
  { intent: 'slangDefinition', patterns: [/\\b(what does .{1,40} mean|what is the meaning of .{1,40}|meaning of .{1,40}|define .{1,40})\\b/i] },
  { intent: 'definition', patterns: [/^\\s*(what is|what are|who is|who are|explain)\\b/i, /\\b(define|definition of|meaning of)\\b/i] },
  { intent: 'activityInfo', patterns: [/\\b(what'?s|what is|any) (the )?(activity|activities|plan|plans|agenda) (for )?(today|tonight|this evening)\\b/i] },
  // Specific emotional/social intents precede broad language and generic conversation matches.
  { intent: 'disagreement', patterns: [/\b(i disagree|not true|you're wrong|you are wrong|i don't think so|i don't agree|that is incorrect)\b/i] },
  { intent: 'relationships', patterns: [/\b(relationship|dating|date|crush|boyfriend|girlfriend|partner|situationship|talking stage|breakup|break up|marriage|married|cheating|red flag|green flag)\b/i] },
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
  { intent: 'wellbeing', patterns: [/\bhow are you\b/i, /\bhow you dey\b/i, /\bhow body\b/i, /\bhow far\b/i, /\bhow is your day\b/i] },
  { intent: 'greeting', patterns: [/^\s*(hi|hello|hey|yo|good morning|good afternoon|good evening|good night)\b/i, /\bbawo ni\b/i] },
  { intent: 'clarification', patterns: [/\bwhat do you mean\b/i, /\bexplain\b/i, /\bclarify\b/i, /\bi don't understand\b/i, /\bwhat does that mean\b/i] },
  { intent: 'followup', patterns: [/\bwhy did you say\b/i, /\bwhy\b/i, /\bare you serious\b/i, /\bwhat happened next\b/i, /\bhow come\b/i] },
  { intent: 'boredom', patterns: [/\b(bored|boring|nothing to do|i'm idle|i am idle)\b/i] },
  { intent: 'group', patterns: [/\b(group|everybody|everyone|hot seat|truth or dare|who is online)\b/i] },
  { intent: 'yoruba', patterns: [/\b(mo n|bawo|kilode|soro|o ti|se o)\b/i] },
  { intent: 'pidgin', patterns: [/\b(abeg|wetin|dey|na so|omo|yarn|wahala|e choke)\b/i] },
  { intent: 'teasing', patterns: [/\b(you are funny|you sef|you no get|see this one|you dey craze)\b/i] }
];

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

export function pickLibraryReply(text = '') {
  const intent = classifyIntent(text);
  const replies = responseLibrary[intent] || responseLibrary.fallback;
  return replies[Math.floor(Math.random() * replies.length)];
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
