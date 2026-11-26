import { baseGuyTruths, baseLadyTruths } from './todBase.js';

const COLORS = ['red', 'yellow', 'orange', 'ash'];

const guyThemes = {
  red: [
    'the last time you stroked your dick thinking about someone in this group or a side chick',
    'a time you fucked somebody and the condom broke or you pulled out late',
    'the dirtiest thing you have ever done with a girl in a hotel or short-time',
    'a secret body count story you never told your boys',
    'the moment you nutted inside and pretended nothing happened',
    'a time you paid for runs or was the one getting paid',
    'the wildest thing you made a girl do with her mouth',
    'a jealousy moment that made you almost catch feelings or catch a case',
    'a private fantasy involving someone you see every day that you have never admitted',
    'the riskiest place you have ever fucked or gotten head'
  ],
  yellow: [
    'a time you almost got caught while stroking or fucking',
    'the first time you tasted a girl and how it really felt',
    'a message you sent that was pure thirst and she replied nasty',
    'a date that ended with you both half-naked but no full sex',
    'the last time you watched porn and what exactly made you nut',
    'a time you lied about your body count to impress someone',
    'the boldest voice note or picture you have ever sent a girl',
    'a moment when a girl sucked you so good you almost lost control',
    'a secret kink you only do when the lights are off',
    'the last person you wanted to fuck but could not because of respect or fear'
  ],
  orange: [
    'a fantasy you have about bending someone over that you see regularly',
    'how you really talk when you are deep inside and the dirty things you say',
    'a time you surprised yourself with how long you lasted or how fast you finished',
    'what makes your dick get hard the fastest in real life',
    'a romantic risk you almost took that would have turned sexual fast',
    'how you balance wanting to fuck and not catching feelings',
    'a private preference you only tell girls after the third round',
    'what makes sex actually good for you beyond just nutting',
    'how you would plan a night of pure fucking with a willing girl',
    'a lesson you learned the hard way about girls and sex in Lagos or wherever you dey'
  ],
  ash: [
    'a time you had to stop yourself from catching feelings after good sex',
    'how you handle it when a girl you fuck starts acting possessive',
    'the most honest conversation you ever had after sex',
    'a boundary you set with a side chick or main chick that actually worked',
    'what loyalty really means to you when you have options',
    'how you know a girl is genuinely interested and not just for runs',
    'a time patience in the bedroom paid off big time',
    'what makes you feel secure enough to go raw or go deep',
    'how you rebuild trust after you or she messed up sexually',
    'the difference between just fucking and actually connecting for you'
  ]
};

const ladyThemes = {
  red: [
    'the last time you played with your pussy thinking about someone specific until you came',
    'a time you let a guy fuck you without condom and the real reason',
    'the dirtiest thing you have ever done with a guy in a hotel or short-time',
    'a secret body count or runs story you never told your girls',
    'the moment a guy nutted inside you and you just took it',
    'a time you collected money or gifts after sex and how it felt',
    'the wildest thing you have done with your mouth or let a guy do to you',
    'a jealousy moment that made you almost fight or block somebody',
    'a private fantasy involving someone you see every day that you have never admitted',
    'the riskiest place you have ever been fingered, fucked or given head'
  ],
  yellow: [
    'a time you almost got caught while touching yourself or fucking',
    'the first time a guy went down on you and how it really felt',
    'a message you sent that was pure thirst and he replied nasty',
    'a date that ended with both of you half-naked but no full sex',
    'the last time you watched porn or read nasty stories and what made you wet',
    'a time you lied about your body count or experience to impress someone',
    'the boldest voice note or picture you have ever sent a guy',
    'a moment when a guy ate you so good you almost lost control',
    'a secret kink you only do when the lights are off or you are alone',
    'the last person you wanted to fuck but could not because of respect or fear'
  ],
  orange: [
    'a fantasy you have about riding or being bent over by someone you see regularly',
    'how you really sound and the dirty things you say when you are close to cumming',
    'a time you surprised yourself with how wet you got or how hard you came',
    'what makes your pussy get wet the fastest in real life',
    'a romantic risk you almost took that would have turned sexual fast',
    'how you balance wanting good dick and not catching feelings',
    'a private preference you only tell guys after the third round',
    'what makes sex actually good for you beyond just cumming',
    'how you would plan a night of pure fucking with a willing guy',
    'a lesson you learned the hard way about guys and sex in Lagos or wherever you dey'
  ],
  ash: [
    'a time you had to stop yourself from catching feelings after good sex',
    'how you handle it when a guy you fuck starts acting possessive or soft',
    'the most honest conversation you ever had after sex',
    'a boundary you set with a side guy or main guy that actually worked',
    'what loyalty really means to you when you have options',
    'how you know a guy is genuinely interested and not just for the body',
    'a time patience in the bedroom paid off big time',
    'what makes you feel secure enough to go raw or go all the way',
    'how you rebuild trust after you or he messed up sexually',
    'the difference between just fucking and actually connecting for you'
  ]
};

const truthFrames = [
  topic => `Spill the full real story of ${topic}. No filter, no soft version. What exactly happened, how it felt, and what you still think about it?`,
  topic => `Walk us through the dirtiest details of ${topic} from the first second to the last. Do not skip the nasty parts.`,
  topic => `What is the most fucked-up or complicated part of ${topic} for you, and why do you still think about it?`,
  topic => `Describe the exact moment involving ${topic} that changed how you see sex, trust, or yourself. Be specific.`,
  topic => `How has ${topic} shaped the way you move with people sexually, and which real experience forced that lesson?`,
  topic => `If your closest person knew the real version of ${topic}, what would shock them the most and why?`,
  topic => `Explain the boldest, nastiest decision you made around ${topic}, including every reason and the outcome.`,
  topic => `What do you wish people understood about your real experience with ${topic}? Say it raw.`,
  topic => `Compare how you used to handle ${topic} before versus now. What dirty truth changed you?`,
  topic => `If you had to tell one completely honest, no-shame story that captures ${topic} for you, which one is it and why that one?`
];

const actionDares = [
  'Record a clear 20-second voice note while you slowly stroke your dick or rub your pussy. Describe exactly how it feels in real time and post it.',
  'Take off your pants or underwear right now, touch yourself for 30 full seconds, then send a voice note admitting how wet or hard you got.',
  'Send a voice note describing the exact way you want someone to fuck you or how you want to fuck them — use the real dirty words.',
  'Play with your nipples or balls for one full minute while recording a voice note of the sounds and how it makes you feel.',
  'Finger yourself or stroke yourself until you are close, then stop and record a frustrated voice note explaining why you stopped.',
  'Send a voice note of you moaning the name of the last person you fucked or wanted to fuck while you touch yourself lightly.',
  'Describe in a 25-second voice note the exact position you want to be fucked in right now and what you would do with your hands.',
  'Rub your clit or the head of your dick in slow circles for 40 seconds and narrate every sensation in a voice note.',
  'Record yourself saying the nastiest thing you have ever said during sex, then immediately touch yourself and keep talking.',
  'Send a voice note while you slap your ass or thighs and describe how you want someone to handle your body.',
  'Get yourself halfway there with your hand, stop, and record a voice note begging the group (in character) to let you finish.',
  'Describe in filthy detail how your last orgasm felt while you lightly touch yourself and record it.',
  'Record a 30-second voice note of pure dirty talk as if you are about to fuck someone in this chat. No soft language.',
  'Play with yourself using only two fingers or light strokes for one minute and count out loud how close you are getting.',
  'Send a voice note explaining the exact taste or smell you remember from the last time you went down on someone or they went down on you.',
  'Touch the most sensitive part of your body right now and describe the pulse or wetness in a voice note without stopping.',
  'Record yourself saying “I want to cum” repeatedly while you edge yourself for 20 seconds, then stop and post it.',
  'Describe the last time you squirted or came hard while you rub yourself lightly and keep the voice note going.',
  'Send a voice note of you pretending to deep-throat or ride someone, complete with the wet sounds and dirty commentary.',
  'Use your free hand to grab your own throat lightly while you touch yourself and record how it changes the feeling.',
  'Record a full minute of you edging — start, stop, start, stop — and narrate every time you pull back.',
  'Say the name of a body part you want sucked or fucked right now and keep repeating it while you touch that area yourself.',
  'Send a voice note while you spread yourself or stroke the full length and describe the temperature and wetness.',
  'Get yourself very close, stop completely, and record a desperate 15-second voice note about how much you need to finish.',
  'Describe in real time how your pussy or dick looks and feels right now while you keep touching it slowly.',
  'Record yourself giving the dirtiest possible instructions on how someone should fuck you tonight.',
  'Play with your pussy or dick using spit or lube if you have it, and narrate the difference in a voice note.',
  'Send a voice note of you moaning through an almost-orgasm then forcing yourself to stop mid-way.',
  'Touch yourself in the exact way that always makes you cum the fastest and count down from 10 while doing it.',
  'Record a final 25-second voice note admitting the nastiest thing you just did to yourself for this dare and how close you got.'
];

function normalizePrompt(value) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function convertLegacyTruth(prompt, gender, index) {
  const clean = String(prompt || '').trim().replace(/[?!.]+$/, '');
  return {
    id: `legacy-${gender}-${String(index + 1).padStart(3, '0')}`,
    text: `Explain the real story behind this with no soft filter: “${clean}”. What exactly happened, how did it feel in the moment, and what do you still think about it?`
  };
}

function buildGenderColorBank(gender, legacy, themes) {
  const result = {};
  for (const color of COLORS) {
    const legacyCards = legacy.slice(0, 50).map((prompt, index) => convertLegacyTruth(prompt, gender, index));
    const generated = themes[color].flatMap((topic, topicIndex) =>
      truthFrames.map((frame, frameIndex) => ({
        id: `truth-${gender}-${color}-${String(topicIndex * 10 + frameIndex + 1).padStart(3, '0')}`,
        text: frame(topic)
      }))
    );
    const truths = [...legacyCards, ...generated].slice(0, 150);
    // Intensity prefixes stay hidden from players — they only see the dare text.
    const challengeDirection = {
      red: 'Do this right now with full commitment. No half measures. Record every second and post the real thing.',
      yellow: 'Make it personal and nasty. Include one specific dirty detail and deliver it without laughing.',
      orange: 'Keep the energy high and finish with a clear, filthy flourish. Do not soften it.',
      ash: 'Put your own dirty spin on it. Add one unexpected or funny-nasty twist that still keeps it real.'
    }[color];
    const dares = actionDares.map((text, index) => ({
      id: `dare-${gender}-${color}-${String(index + 1).padStart(3, '0')}`,
      // The same underlying action must be unique across every colour and gender.
      // Colour changes the delivery direction, not the action's identity.
      reuseKey: `dare-${String(index + 1).padStart(3, '0')}`,
      text: `${challengeDirection} ${text}`
    }));
    if (truths.length !== 150 || dares.length !== 30) {
      throw new Error(`Invalid PICK YOUR SIN bank size for ${gender}/${color}: ${truths.length} truths, ${dares.length} dares.`);
    }
    result[`${gender}:${color}`] = { truths, dares };
  }
  return result;
}

export function buildPickYourSinBank() {
  return {
    ...buildGenderColorBank('guy', baseGuyTruths, guyThemes),
    ...buildGenderColorBank('lady', baseLadyTruths, ladyThemes)
  };
}

export function normalizePickYourSinPrompt(value) {
  return normalizePrompt(value);
}

export const PICK_YOUR_SIN_BANK_COUNTS = Object.freeze({
  colors: 4,
  genders: 2,
  truthsPerGenderColor: 150,
  daresPerGenderColor: 30
});
