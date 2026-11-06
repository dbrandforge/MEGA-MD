import { describe, it, expect } from 'vitest';
import {
  dualExpansionStats,
  dualBankExpansionComplete,
} from '../../data/chatDual/chatDual_expansion_index.js';
import { classifyIntent } from '../../data/chatbotResponseLibrary.js';
import { pickDualReply, getDualBankStats, scoreResponseRelevance } from '../../data/chatDual/dualBankSelector.js';
import firstSexAdviceModule from '../../data/chatDual/ev_0_0.js';
import secondSexAdviceModule from '../../data/chatDual/ev_0_1.js';
import thirdSexAdviceModule from '../../data/chatDual/ev_0_2.js';
import fourthSexAdviceModule from '../../data/chatDual/ev_0_3.js';
import fifthSexAdviceModule from '../../data/chatDual/ev_1_0.js';
import sixthSexAdviceModule from '../../data/chatDual/ev_1_1.js';
import firstRelationshipExpansionModule from '../../data/chatDual/ev_1_2.js';
import secondRelationshipExpansionModule from '../../data/chatDual/ev_1_3.js';
import thirdRelationshipExpansionModule from '../../data/chatDual/ev_2_0.js';
import fourthRelationshipExpansionModule from '../../data/chatDual/ev_2_1.js';

describe('ChatDual expansion bank', () => {
  it('reports complete and exact 5,183-pair expansion', () => {
    expect(dualBankExpansionComplete).toBe(true);
    expect(dualExpansionStats()).toEqual({
      core: 175,
      expand: 2908,
      yoruba: 400,
      conversational: 500,
      gist: 375,
      financialNeed: 375,
      relationshipExtra: 450,
      total: 5183,
    });
  });

  it('checks the preserved row inventory and exact-string uniqueness of the six sex-advice modules', () => {
    const modules = [firstSexAdviceModule, secondSexAdviceModule, thirdSexAdviceModule, fourthSexAdviceModule, fifthSexAdviceModule, sixthSexAdviceModule];
    const expectedRows = [182, 182, 182, 181, 182, 51];
    modules.forEach((module, index) => {
      const rows = module.sexAdvice;
      expect(rows).toHaveLength(expectedRows[index]);
      expect(new Set(rows.map(row => row.a)).size).toBe(expectedRows[index]);
      expect(new Set(rows.map(row => row.b)).size).toBe(expectedRows[index]);
      expect(rows.every(row => typeof row.a === 'string' && typeof row.b === 'string')).toBe(true);
    });
  });

  it('keeps the fourth sex-advice module substantive and free of legacy templates', () => {
    const rows = fourthSexAdviceModule.sexAdvice;
    expect(rows).toHaveLength(181);
    expect(new Set(rows.map(row => row.a)).size).toBe(181);
    expect(new Set(rows.map(row => row.b)).size).toBe(181);
    expect(new Set(rows.flatMap(row => [row.a, row.b])).size).toBe(362);
    expect(rows.every(row => row.a.length >= 60 && row.b.length >= 60)).toBe(true);
    const legacyFragments = [
      'exact recipient and platform',
      'every new use or audience',
      'activity or partner changes',
      'an unfamiliar symptom appears',
      'the activity and its risks',
      'a new prescription is started',
      'a boundary has already been stated',
      'someone withdraws permission',
      'either person asks to stop',
    ];
    const content = rows.map(row => `${row.a} ${row.b}`).join(' ').toLowerCase();
    expect(legacyFragments.some(fragment => content.includes(fragment))).toBe(false);
  });

  it('keeps the fifth sex-advice module substantive and free of repeated filler', () => {
    const rows = fifthSexAdviceModule.sexAdvice;
    expect(rows).toHaveLength(182);
    expect(new Set(rows.map(row => row.a)).size).toBe(182);
    expect(new Set(rows.map(row => row.b)).size).toBe(182);
    expect(new Set(rows.flatMap(row => [row.a, row.b])).size).toBe(364);
    expect(rows.every(row => row.a.length >= 60 && row.b.length >= 60)).toBe(true);
    expect(rows.every(row => row.a !== row.b)).toBe(true);
  });

  it('keeps the sixth sex-advice module substantive and free of repeated filler', () => {
    const rows = sixthSexAdviceModule.sexAdvice;
    expect(rows).toHaveLength(51);
    expect(new Set(rows.map(row => row.a)).size).toBe(51);
    expect(new Set(rows.map(row => row.b)).size).toBe(51);
    expect(new Set(rows.flatMap(row => [row.a, row.b])).size).toBe(102);
    expect(rows.every(row => row.a.length >= 60 && row.b.length >= 60)).toBe(true);
  });

  it('keeps the first relationship expansion module substantive and free of repeated filler', () => {
    const rows = firstRelationshipExpansionModule.relationship;
    expect(rows).toHaveLength(182);
    expect(new Set(rows.map(row => row.a)).size).toBe(182);
    expect(new Set(rows.map(row => row.b)).size).toBe(182);
    expect(new Set(rows.flatMap(row => [row.a, row.b])).size).toBe(364);
    expect(rows.every(row => row.a.length >= 60 && row.b.length >= 60)).toBe(true);
  });

  it('keeps the second relationship expansion module substantive and free of repeated filler', () => {
    const rows = secondRelationshipExpansionModule.relationship;
    expect(rows).toHaveLength(181);
    expect(new Set(rows.map(row => row.a)).size).toBe(181);
    expect(new Set(rows.map(row => row.b)).size).toBe(181);
    expect(new Set(rows.flatMap(row => [row.a, row.b])).size).toBe(362);
    expect(rows.every(row => row.a.length >= 60 && row.b.length >= 60)).toBe(true);
    expect(rows.every(row => row.a !== row.b)).toBe(true);
  });

  it('keeps the third relationship expansion module substantive and free of repeated filler', () => {
    const rows = thirdRelationshipExpansionModule.relationship;
    expect(rows).toHaveLength(182);
    expect(new Set(rows.map(row => row.a)).size).toBe(182);
    expect(new Set(rows.map(row => row.b)).size).toBe(182);
    expect(new Set(rows.flatMap(row => [row.a, row.b])).size).toBe(364);
    expect(rows.every(row => row.a.length >= 60 && row.b.length >= 60)).toBe(true);
    expect(rows.every(row => row.a !== row.b)).toBe(true);
  });

  it('keeps the fourth relationship expansion module substantive and free of repeated filler', () => {
    const rows = fourthRelationshipExpansionModule.relationship;
    expect(rows).toHaveLength(182);
    expect(new Set(rows.map(row => row.a)).size).toBe(182);
    expect(new Set(rows.map(row => row.b)).size).toBe(182);
    expect(new Set(rows.flatMap(row => [row.a, row.b])).size).toBe(364);
    expect(rows.every(row => row.a.length >= 60 && row.b.length >= 60)).toBe(true);
    expect(rows.every(row => row.a !== row.b)).toBe(true);
  });

  it("scores the response that shares the user's actual topic more highly", () => {
    const prompt = 'My partner and I need to discuss consent and boundaries before intimacy';
    const relevant = 'Talk openly about consent and boundaries before intimacy begins.';
    const unrelated = 'A healthy budget starts with tracking monthly expenses.';
    expect(scoreResponseRelevance(prompt, relevant)).toBeGreaterThan(
      scoreResponseRelevance(prompt, unrelated)
    );
  });

  it('can return response A, response B, or both complementary sides', () => {
    const prompt = 'I need advice about my career';
    const base = { chatId: 'response-mode-check', intent: 'advice' };
    const a = pickDualReply(prompt, { ...base, responseMode: 'a' });
    const b = pickDualReply(prompt, { ...base, responseMode: 'b' });
    const both = pickDualReply(prompt, { ...base, responseMode: 'both' });

    expect(typeof a).toBe('string');
    expect(typeof b).toBe('string');
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
    expect(both.split('\n\n')).toHaveLength(2);
    expect(both.split('\n\n').every(part => part.trim().length > 0)).toBe(true);
  });

  it('routes classified relationship, friendship, work-life and advice prompts', () => {
    const cases = [
      ['My situationship only texts at night', 'relationships'],
      ['My friend betrayed my trust', 'friendship'],
      ['What should I do about my boss?', 'advice'],
      ['I need advice about my career', 'advice'],
    ];
    for (const [prompt, expectedIntent] of cases) {
      expect(classifyIntent(prompt)).toBe(expectedIntent);
      expect(pickDualReply(prompt, {
        chatId: `routing-${expectedIntent}-${prompt}`,
        intent: classifyIntent(prompt),
      })).toBeTruthy();
    }
  });

  it('routes financial, wellbeing, Yoruba, pidgin, gist and flirty prompts', () => {
    const cases = [
      ['I need money urgently', 'financialNeed'],
      ['I feel burnt out and anxious', 'empathy'],
      ['Mo n gbo e', 'yoruba'],
      ['Abeg yarn me well', 'pidgin'],
      ['Spill the gist', 'fallback'],
      ['I have a crush on someone', 'flirty'],
    ];
    for (const [prompt, expectedIntent] of cases) {
      expect(classifyIntent(prompt)).toBe(expectedIntent);
      expect(pickDualReply(prompt, {
        chatId: `routing-${expectedIntent}-${prompt}`,
        intent: classifyIntent(prompt),
      })).toBeTruthy();
    }
  });

  it('uses recent context to recover the topic of a short follow-up', () => {
    const reply = pickDualReply('What if they say no?', {
      chatId: 'contextual-follow-up',
      intent: 'fallback',
      context: ['My partner and I need to discuss consent and boundaries before intimacy.'],
    });
    expect(typeof reply).toBe('string');
    expect(reply.length).toBeGreaterThan(5);
  });

  it('routes sexual-health and consent advice to ChatDual', () => {
    const reply = pickDualReply('Is continuous consent required during a scene?', { chatId: 'test-sex-advice' });
    expect(typeof reply).toBe('string');
    expect(reply.length).toBeGreaterThan(5);
  });

  it('leaves pure dirty talk to the existing personality bank', () => {
    expect(pickDualReply('talk dirty to me', { chatId: 'test-dirty-talk' })).toBeNull();
  });

  it('exposes populated category pools used by the router', () => {
    const stats = getDualBankStats();
    expect(stats.complete).toBe(true);
    for (const category of ['sexAdvice', 'relationship', 'wellbeing', 'advice', 'flirty', 'yoruba', 'conversational', 'gist', 'financialNeed']) {
      expect(stats.categories[category], `missing category pool: ${category}`).toBeGreaterThan(0);
    }
  });
});
