import { describe, it, expect } from 'vitest';
import {
  dualExpansionStats,
  dualBankExpansionComplete,
} from '../../data/chatDual/chatDual_expansion_index.js';
import { classifyIntent } from '../../data/chatbotResponseLibrary.js';
import { pickDualReply, getDualBankStats } from '../../data/chatDual/dualBankSelector.js';
import firstSexAdviceModule from '../../data/chatDual/ev_0_0.js';
import secondSexAdviceModule from '../../data/chatDual/ev_0_1.js';
import thirdSexAdviceModule from '../../data/chatDual/ev_0_2.js';
import fourthSexAdviceModule from '../../data/chatDual/ev_0_3.js';

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

  it('checks the preserved row inventory and exact-string uniqueness of the four sex-advice modules', () => {
    const modules = [firstSexAdviceModule, secondSexAdviceModule, thirdSexAdviceModule, fourthSexAdviceModule];
    const expectedRows = [182, 182, 182, 181];
    modules.forEach((module, index) => {
      const rows = module.sexAdvice;
      expect(rows).toHaveLength(expectedRows[index]);
      expect(new Set(rows.map(row => row.a)).size).toBe(expectedRows[index]);
      expect(new Set(rows.map(row => row.b)).size).toBe(expectedRows[index]);
      expect(rows.every(row => typeof row.a === 'string' && typeof row.b === 'string')).toBe(true);
    });
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
