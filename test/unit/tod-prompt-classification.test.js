import { describe, expect, it } from 'vitest';
import { getDares, getTruths } from '../../data/todLists.js';

const truthLike = /^(?:confess|admit|have you|ever\b|what\\b|who\\b|when\\b|where\\b|which\\b|why\\b|how often\\b|how many\\b|favorite\\b|favourite\\b|biggest\\b|worst\\b|best\\b|last time\\b|tell (?:us|the group)\\b|share (?:your|the)\\b|body count\\b|describe (?:your last|the last time|a time)\\b)/i;

describe('Truth-or-Dare prompt classification', () => {
  it.each(['guy', 'lady'])('keeps truth-style disclosures out of the %s dare pool', gender => {
    const dares = getDares(gender);
    expect(dares.length).toBeGreaterThan(0);
    expect(dares.some(prompt => truthLike.test(prompt.trim()))).toBe(false);
  });

  it.each(['guy', 'lady'])('preserves reclassified disclosures in the %s truth pool', gender => {
    const truths = getTruths(gender).map(prompt => prompt.trim());
    expect(truths.some(prompt => /^(?:confess|admit|have you|ever\\b|what\\b|who\\b|tell (?:us|the group)\\b)/i.test(prompt))).toBe(true);
  });
});
