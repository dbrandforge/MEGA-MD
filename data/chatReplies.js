import { moreDirty, morePidgin, moreSavage, moreSocial } from './chatRepliesMore.js';

export const replyBank = {
  greeting: [
    "How far fra 🔥","Wetin dey sup?","I dey cam. Talk.","E choke already 😏","Soft life loading...",
    "Abeg no form, talk.","You don show. Make we yarn.","Fraaa what’s good?","I see you. Spill.",
    "Correct energy.","Bawo ni? 😏","How body?","You good?","I dey. Talk.","Wetin bring you?",
    "Hello correct one","You dey?","I dey available","Talk your mind","No string am, yarn"
  ],
  flirty: [
    "You dey try me sha 🔥","Keep talking like that and something go happen.",
    "Your mouth sweet but mind dirtier.","You need attention... the dirty kind.",
    "Continue make I know how far.","You dey feel yourself. I like am.","Say that again slower.",
    "Dirty talk or soft play first?","You dey look for correct trouble.","Your vibe dey do me somehow.",
    "No dey shy. You don start.","I fit match and raise your energy.","You dey play with fire.",
    "Keep that energy when e get explicit.","Soft or rough talk?","You dey smile for chat.",
    "E go leave PG sharp.","Attention or instructions?","Open up make I talk proper.",
    "Your message get spice. Add more.","You sound like night energy.","I fit get dirty if you open the door.",
    "That tone no be ordinary.","You wan make person blush or wet?","Talk am like you mean am.",
    "You dey test boundaries. Correct.","I dey game if you dey game.","No half measures with me.",
    "Your last line get heat.","Raise the temperature small."
  ],
  dirty: [
    "Talk clear. Soft moans or ruin-with-words?","You sound hungry. Make I feed that side?",
    "Describe wetin you want. No skip details.","Body language through text dey loud.",
    "Confession or instruction?","I fit talk like you dey under me. Ready?","No code. Say the dirty thing.",
    "Your mind don leave PG long time.","Last time you touch yourself — wetin you think?",
    "Degrade or dirty praise?","That message get heat. Match carefully.","I go talk raw if you gree.",
    "Make the next one filthier.","No hide. This group no be church.","Where you want attention and how?",
    "You dey touch something while chatting?","Clothes don reduce for your mind.",
    "I fit dirty the chat if you open door.","Raise the temperature.","Talk the fantasy. No packaging.",
    ...moreDirty
  ],
  savage: [...moreSavage],
  pidgin: [...morePidgin],
  yoruba: [
    "Bawo ni? 😏","Se o n dun e ni?","Soro die sii.","Mo n gbo e.","Ko buru... continue.",
    "O ti start. Ma stop.","Kilode?","O n try mi ni.","Sooto lo so.","Mo wa nibe. Soro.",
    "Bawo lo se wa?","Soro die sii jare.","Mo gbo e.","O dara. Continue.","Ma da duro."
  ],
  social: [...moreSocial],
  fallback: [
    "Talk am again make I catch am 🔥","Fraaa... wetin you talk again?","Drop am one more time.",
    "Make I reason am. Talk again.","Repeat wetin you talk.",
    "I almost reply dirty but line cut. Try again 😏","Say that one more time.","Hit me again.",
    "E choke me small. Talk again.","I miss the main point. Repeat.","Network scratch. Again.",
    "Say am clear.","I dey here. Reload the message.","One more time, correct one.","Abeg repeat."
  ]
};

export function allReplies() {
  return Object.values(replyBank).flat();
}

export const keywordMap = [
  { keys: ['hi','hello','how far','hey','good morning','good evening','good night','bawo','wetin dey','sup','how body'], cat: 'greeting' },
  { keys: ['fuck','sex','dick','pussy','ass','cum','horny','wet','hard','stroke','suck','ride','nudes','naked','bed','touch','finger','mouth','throat','moan','orgasm','fantasy','boobs','nipple'], cat: 'dirty' },
  { keys: ['fine','beautiful','handsome','crush','like you','attracted','sexy','fine girl','fine boy','babe','baby'], cat: 'flirty' },
  { keys: ['mumu','foolish','stupid','mad','craze','werey','dull','weak','nonsense'], cat: 'savage' },
  { keys: ['abeg','wetin','how far','no be','e choke','fra','correct','soft life','no string','yarn'], cat: 'pidgin' },
  { keys: ['bawo','se o','kilode','soro','mo n','o ti','jare'], cat: 'yoruba' },
  { keys: ['group','hot seat','wcw','truth','dare','anonymous','basket'], cat: 'social' }
];

export function pickReply(userText) {
  const lower = (userText || '').toLowerCase();
  for (const map of keywordMap) {
    if (map.keys.some(k => lower.includes(k))) {
      const list = replyBank[map.cat] || replyBank.fallback;
      return list[Math.floor(Math.random() * list.length)];
    }
  }
  const mix = [...replyBank.flirty, ...replyBank.pidgin, ...replyBank.greeting, ...replyBank.social];
  return mix[Math.floor(Math.random() * mix.length)];
}

export default { replyBank, keywordMap, pickReply, allReplies };
