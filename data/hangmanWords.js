import { SEEDS_A } from './hangmanSeedsA.js';
import { SEEDS_B } from './hangmanSeedsB.js';
import { SEEDS_C } from './hangmanSeedsC.js';
import { SEEDS_D } from './hangmanSeedsD.js';

// Sound-alike prompts are deliberately short alternate words, not definitions.
// Prefer exact homophones; otherwise use a clear, familiar rhyme.
const SOUND_ALIKES = {
  aftercare: 'affair', afterglow: 'after-show', anal: 'canal',
  arousal: 'carousal', ballgag: 'sag', begging: 'legging',
  biting: 'fighting', bound: 'found', brat: 'cat',
  breathless: 'restless', bruised: 'used', carsex: 'farce',
  caught: 'court', cheek: 'peak', climax: 'climax? no',
  collar: 'dollar', consent: 'descent', control: 'patrol',
  cuddle: 'puddle', cuffs: 'puffs', dare: 'hair',
  denial: 'rental', degrade: 'parade', deep: 'sleep',
  desire: 'fire', dirtytalk: 'walk', discipline: 'crispin',
  edging: 'pledging', erotic: 'exotic', exposed: 'supposed',
  facial: 'racial', fast: 'last', fetish: 'let it',
  filthy: 'guilty', finish: 'Finnish', flirt: 'shirt',
  floor: 'four', foreplay: 'doorway', freeuse: 'reuse',
  gag: 'bag', gentle: 'rental', ghosting: 'boasting',
  goodgirl: 'good pearl', goodboy: 'wood toy', grind: 'find',
  hard: 'card', horny: 'corny', hotel: 'motel',
  hydrate: 'high rate', initiate: 'appreciate', jealous: 'zealous',
  kneeling: 'feeling', kinky: 'slinky', kiss: 'bliss',
  leash: 'leash? no', leather: 'weather', lingerie: 'cafeteria',
  live: 'five', lube: 'tube', lust: 'dust',
  makeout: 'takeout', marking: 'parking', match: 'catch',
  mature: 'nature', messy: 'dressy', midnight: 'daylight',
  moaning: 'groaning', nudes: 'moods', oral: 'moral',
  owner: 'boner', paddle: 'saddle', pair: 'pear',
  pause: 'cause', pegging: 'begging', petplay: 'getaway',
  pillow: 'willow', plug: 'slug', praise: 'raise',
  private: 'pirate', public: 'republic', quickie: 'tricky',
  rough: 'tough', roundtwo: 'sound too', safe: 'waif',
  safeword: 'say word', scene: 'seen', secret: 'decree',
  session: 'question', shame: 'flame', shower: 'power',
  silent: 'violent', sir: 'stir', slow: 'glow',
  soft: 'loft', solo: 'YOLO', spanking: 'ranking',
  spooning: 'tuning', stamina: 'lamina', standing: 'landing',
  stop: 'top', striptease: 'expertise', submissive: 'dismissive',
  sweat: 'threat', tease: 'cheese', tension: 'mention',
  text: 'next', throat: 'float', thrust: 'trust',
  timer: 'climber', tonight: 'moonlight', toybox: 'boy’s socks',
  trust: 'rust', truth: 'tooth', turnon: 'burn one',
  vanilla: 'gorilla', vibe: 'tribe', vibrator: 'navigator',
  voice: 'choice', warmup: 'farm up', wetness: 'witness',
  whisper: 'sister', winner: 'dinner', worship: 'warship',
  yellow: 'mellow', yes: 'mess', yearning: 'learning',
  zaddy: 'daddy'
};

export const WORDS = (() => {
  const out = [];
  const seen = new Set();
  for (const row of [...SEEDS_A, ...SEEDS_B, ...SEEDS_C, ...SEEDS_D]) {
    const [word, category, hint, synonymHint, e1, e2] = row;
    // Hangman needs single tokens — strip spaces and non-letters.
    const key = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!key || key.length < 3 || seen.has(key)) continue;
    seen.add(key);
    out.push({
      word: key,
      category,
      hint,
      synonymHint,
      soundAlikeHint: SOUND_ALIKES[key] || null,
      extraHints: [e1, e2]
    });
  }
  return out;
})();

export default WORDS;
