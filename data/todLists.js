import {
  extraGuyTruths, extraLadyTruths, extraGuyDares, extraLadyDares
} from './todExtra.js';
import {
  megaGuyTruths, megaLadyTruths, megaGuyDares, megaLadyDares
} from './todMega.js';
import {
  baseGuyTruths, baseLadyTruths, baseGuyDares, baseLadyDares
} from './todBase.js';

export const guyTruths = [...baseGuyTruths, ...extraGuyTruths, ...megaGuyTruths];
export const ladyTruths = [...baseLadyTruths, ...extraLadyTruths, ...megaLadyTruths];
export const guyDares = [...baseGuyDares, ...extraGuyDares, ...megaGuyDares];
export const ladyDares = [...baseLadyDares, ...extraLadyDares, ...megaLadyDares];

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
