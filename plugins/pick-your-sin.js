import store from '../lib/lightweight_store.js';
import { getUserGender } from './gender.js';
import { buildPickYourSinBank, normalizePickYourSinPrompt } from '../data/pickYourSinBank.js';
import { isGameAllowed } from './daylock.js';
import { isFeatureGroup } from '../lib/featureGroups.js';
import { sameWhatsAppUser, canonicalWhatsAppUserId } from '../lib/whatsappIdentity.js';

const KEY = 'pickYourSinSessions';
const DAILY_KEY = 'pickYourSinDailyCompletions';
const COOLDOWN_MS = 30_000;
const NO_ANSWER_REMINDER_MS = 5 * 60 * 1000;
const PLAYER_INACTIVITY_MS = 10 * 60 * 1000;
const REPLACEMENT_WINDOW_MS = 5 * 60 * 1000;
const chatQueues = new Map();
const inactivityTimers = new Map();
const replacementTimers = new Map();
async function withChatLock(chatId, task) {
  const previous = chatQueues.get(chatId) || Promise.resolve();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const queued = previous.then(() => gate);
  chatQueues.set(chatId, queued);
  await previous;
  try { return await task(); }
  finally {
    release();
    if (chatQueues.get(chatId) === queued) chatQueues.delete(chatId);
  }
}
const COLORS = {
  red: { emoji: '❤️', label: 'RED' },
  yellow: { emoji: '💛', label: 'YELLOW' },
  orange: { emoji: '🧡', label: 'ORANGE' },
  ash: { emoji: '🩶', label: 'ASH' },
  // Legacy active sessions may still contain GREEN; render them as ASH.
  green: { emoji: '🩶', label: 'ASH' }
};

const ACTION_DARES = [
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

// NOTE: The live game uses buildPickYourSinBank() from data/pickYourSinBank.js.
// The ACTION_DARES array above is retained only for consistency / future fallback.
// All remaining plugin logic is unchanged from main.
