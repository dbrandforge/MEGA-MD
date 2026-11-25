import {
  extraGuyTruths, extraLadyTruths, extraGuyDares, extraLadyDares
} from './todExtra.js';
import {
  megaGuyTruths, megaLadyTruths, megaGuyDares, megaLadyDares
} from './todMega.js';
import {
  baseGuyTruths, baseLadyTruths, baseGuyDares, baseLadyDares
} from './todBase.js';

const truthStyleDare = /^(?:confess|admit|have you|ever\b|what\b|who\b|when\b|where\b|which\b|why\b|how often\b|how many\b|favorite\b|favourite\b|biggest\b|worst\b|best\b|last time\b|tell (?:us|the group)\b|share (?:your|the)\b|body count\b|describe (?:your last|the last time|a time)\b)/i;

function splitPromptPools(truths, dares) {
  const misplacedTruths = dares.filter(prompt => truthStyleDare.test(String(prompt).trim()));
  const actionableDares = dares.filter(prompt => !truthStyleDare.test(String(prompt).trim()));
  return {
    truths: [...truths, ...misplacedTruths],
    dares: actionableDares
  };
}

const guyPools = splitPromptPools(
  [...baseGuyTruths, ...extraGuyTruths, ...megaGuyTruths],
  [...baseGuyDares, ...extraGuyDares, ...megaGuyDares]
);
const ladyPools = splitPromptPools(
  [...baseLadyTruths, ...extraLadyTruths, ...megaLadyTruths],
  [...baseLadyDares, ...extraLadyDares, ...megaLadyDares]
);

export const guyTruths = guyPools.truths;
export const ladyTruths = ladyPools.truths;
export const guyDares = guyPools.dares;
export const ladyDares = ladyPools.dares;

export function getTruths(gender) {
  return gender === 'lady' ? ladyTruths : guyTruths;
}
export function getDares(gender) {
  return gender === 'lady' ? ladyDares : guyDares;
}
export function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
export default { guyTruths, ladyTruths, guyDares, ladyDares, getTruths, getDares, randomFrom };
