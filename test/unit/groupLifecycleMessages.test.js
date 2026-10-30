import { describe, expect, it } from 'vitest';
import {
  goodnightMessages,
  goodmorningMessages,
  memberLeftMessages,
  memberRemovedMessages,
  pickRotatingMessage,
  classifyDeparture
} from '../../data/groupLifecycleMessages.js';

describe('Sin City lifecycle message banks', () => {
  it('provides rotating goodnight and morning greetings with variety', () => {
    expect(goodnightMessages.length).toBeGreaterThanOrEqual(8);
    expect(goodmorningMessages.length).toBeGreaterThanOrEqual(8);
    expect(pickRotatingMessage(goodnightMessages, 0, () => 0).index).not.toBe(0);
  });

  it('has separate self-leave and admin-removal message banks', () => {
    expect(memberLeftMessages.some(message => /don commot|has left|don waka/i.test(message))).toBe(true);
    expect(memberRemovedMessages.some(message => /hear word|red card|escorted out/i.test(message))).toBe(true);
    expect(memberLeftMessages.every(message => message.includes('{name}'))).toBe(true);
    expect(memberRemovedMessages.every(message => message.includes('{name}'))).toBe(true);
  });

  it('distinguishes a voluntary leave from an admin or bot removal', () => {
    const participant = '2348012345678@s.whatsapp.net';
    expect(classifyDeparture({ author: participant }, participant)).toBe('left');
    expect(classifyDeparture({ author: '2348099999999@s.whatsapp.net' }, participant)).toBe('removed');
    expect(classifyDeparture({}, participant)).toBe('unknown');
  });

  it('does not repeat the immediately previous selection when alternatives exist', () => {
    const previous = pickRotatingMessage(memberLeftMessages, -1, () => 0).index;
    const next = pickRotatingMessage(memberLeftMessages, previous, () => 0).index;
    expect(next).not.toBe(previous);
  });
});
