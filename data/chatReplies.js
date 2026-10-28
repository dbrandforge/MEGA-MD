// Large preset reply bank for Mature minded chatbot
// Keyword-matched first, AI only as fallback

export const replyBank = {
  greeting: [
    "How far fra 🔥",
    "Wetin dey sup correct guy/babe?",
    "I dey cam. Talk your own.",
    "E choke already and you just enter 😏",
    "Soft life loading... how you dey?",
    "Abeg no form, talk wetin dey your mind.",
    "You don show. Make we yarn.",
    "Fraaa what’s good?",
    "I see you. Spill.",
    "Correct energy. Talk to me.",
    "Bawo ni? 😏",
    "How body?",
    "You good?",
    "I dey. Talk.",
    "Wetin bring you?"
  ],

  flirty: [
    "You dey try me sha 🔥",
    "Keep talking like that and something go happen.",
    "Your mouth sweet but your mind dirtier, I fit tell.",
    "You sound like somebody wey need attention... the dirty kind.",
    "I dey hear you. Continue make I know how far you wan take am.",
    "Hmm you dey feel yourself. I like am.",
    "Say that thing again slower.",
    "You wan make I talk dirty or you wan soft play first?",
    "E be like say you dey look for trouble. Correct trouble.",
    "Your vibe dey do me somehow. Talk more.",
    "No dey shy now. You don start am.",
    "I fit match your energy... even raise am.",
    "You dey play with fire and the fire dey enjoy am.",
    "Keep that same energy when things get explicit.",
    "I no dey form. You want soft or you want rough talk?",
    "You dey smile for chat. I know that kind smile.",
    "If you continue like this e go leave PG zone sharp.",
    "You want attention or you want instructions?",
    "I fit talk to you proper if you open up.",
    "Your message get spice. Add more."
  ],

  dirty: [
    "Talk am clear. You want soft moans or you want somebody wey go ruin you with words?",
    "You dey sound hungry. Make I feed that side of you?",
    "Describe wetin you want and no skip details.",
    "Your body language through text dey loud. Continue.",
    "You wan confession or you wan instruction?",
    "I fit talk to you like say you dey under me right now. You ready?",
    "No use code. Say the dirty thing you dey think.",
    "E be like say your mind don leave PG zone long time.",
    "Tell me the last time you touch yourself and wetin you dey think.",
    "You want me to degrade you small or praise you dirty?",
    "Hmm... that message get heat. Match my next reply carefully.",
    "I go talk am raw if you gree. You gree?",
    "Your turn. Make am filthier than the last one.",
    "No dey hide. This group no be church.",
    "Say where you want attention and how you want am.",
    "Be honest... you dey touch something while you dey chat?",
    "The way you type, e be like say clothes don reduce.",
    "I fit dirty the chat if you open the door.",
    "Your last message get temperature. Raise am.",
    "Talk the fantasy. No packaging.",
    "You want slow and nasty or fast and rough talk?",
    "Describe how you like to be handled.",
    "Who you go let ruin you if opportunity show for this group?",
    "Say the part of your body wey dey sensitive pass.",
    "You prefer control or you prefer to give am out?",
    "Make the next message dirtier. I dey wait.",
    "No censor. This place no get censors.",
    "Tell me wetin you no fit tell normal people.",
    "You dey wet or you dey hard from this chat? Be honest.",
    "I go meet your energy. Just no stop mid-way."
  ],

  savage: [
    "You dey do too much for ordinary message 😂",
    "Calm down before you embarrass yourself.",
    "E no reach like that fra.",
    "You try, but e still weak.",
    "No be beans... but this one you talk? Soft.",
    "I almost respect the energy then you spoil am.",
    "You dey shout for chat like say network go help you.",
    "Take am easy. Nobody pressurize you.",
    "That one no move me. Try harder.",
    "You sound pressed. Rest small.",
    "E be like say you wan flex. Soft flex.",
    "Collect sense small.",
    "You dey try force am. E no fit."
  ],

  pidgin: [
    "I dey with you. Break am down.",
    "No string am. Talk plain.",
    "Wetin exactly you mean by that?",
    "Abeg clear the matter.",
    "I catch am. Continue.",
    "You sure say na so e be?",
    "Make we no lie ourselves here.",
    "Truth only. No packaging.",
    "E make sense small. Add more.",
    "I hear you loud and clear.",
    "No dey hide under emoji. Talk.",
    "Explain am like say I be mumu.",
    "Oya spill.",
    "No waste time. Talk the main thing."
  ],

  yoruba: [
    "Bawo ni? 😏",
    "Se o n dun e ni?",
    "Soro die sii.",
    "Mo n gbo e.",
    "Ko buru... continue.",
    "O ti start. Ma stop.",
    "Kilode?",
    "O n try mi ni.",
    "Sooto lo so.",
    "Mo wa nibe. Soro."
  ],

  fallback: [
    "Talk am again make I catch am proper 🔥",
    "Fraaa... my head blank for a second. Wetin you talk again?",
    "I dey hear you. Drop am one more time.",
    "Hmm make I reason am. Talk again sharp sharp.",
    "My guy / babe, system just scratch. Repeat wetin you talk.",
    "I almost reply you something very dirty but the line cut. Try again 😏",
    "You dey try me... say that thing one more time make I answer you well.",
    "Network no dey carry me at all. Hit me again.",
    "E choke me small. Talk again.",
    "I miss the main point. Repeat."
  ]
};

// Keyword → category mapping
export const keywordMap = [
  { keys: ['hi', 'hello', 'how far', 'hey', 'good morning', 'good evening', 'good night', 'bawo', 'wetin dey', 'sup'], cat: 'greeting' },
  { keys: ['fuck', 'sex', 'dick', 'pussy', 'ass', 'cum', 'horny', 'wet', 'hard', 'stroke', 'suck', 'ride', 'nudes', 'naked', 'bed', 'touch', 'finger', 'mouth', 'throat', 'moan', 'orgasm', 'body count', 'fantasy'], cat: 'dirty' },
  { keys: ['fine', 'beautiful', 'handsome', 'crush', 'like you', 'attracted', 'sexy', 'fine girl', 'fine boy', 'babe', 'baby'], cat: 'flirty' },
  { keys: ['mumu', 'foolish', 'stupid', 'mad', 'craze', 'werey', 'dull', 'weak'], cat: 'savage' },
  { keys: ['abeg', 'wetin', 'how far', 'no be', 'e choke', 'fra', 'correct', 'soft life', 'no string'], cat: 'pidgin' },
  { keys: ['bawo', 'se o', 'kilode', 'soro', 'mo n', 'o ti'], cat: 'yoruba' }
];

export function pickReply(userText) {
  const lower = (userText || '').toLowerCase();

  for (const map of keywordMap) {
    if (map.keys.some(k => lower.includes(k))) {
      const list = replyBank[map.cat] || replyBank.fallback;
      return list[Math.floor(Math.random() * list.length)];
    }
  }

  // Default mix of flirty/pidgin if no strong match
  const mix = [...replyBank.flirty, ...replyBank.pidgin, ...replyBank.greeting];
  return mix[Math.floor(Math.random() * mix.length)];
}

export default { replyBank, keywordMap, pickReply };
