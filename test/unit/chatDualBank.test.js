import { describe, it, expect } from 'vitest';
import {
  dualExpansionStats,
  dualBankExpansionComplete,
} from '../../data/chatDual/chatDual_expansion_index.js';
import { pickDualReply, getDualBankStats } from '../../data/chatDual/dualBankSelector.js';

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

  it('routes sexual-health and consent advice to ChatDual', () => {
    const reply = pickDualReply('Is continuous consent required during a scene?', { chatId: 'test-sex-advice' });
    expect(typeof reply).toBe('string');
    expect(reply.length).toBeGreaterThan(5);
  });

  it('leaves pure dirty talk to the existing personality bank', () => {
    expect(pickDualReply('talk dirty to me', { chatId: 'test-dirty-talk' })).toBeNull();
  });

  it('routes relationship, financial, wellbeing and Yoruba prompts', () => {
    expect(pickDualReply('My situationship only texts at night', { chatId: 'test-relationship' })).toBeTruthy();
    expect(pickDualReply('I need money urgently', { chatId: 'test-money', intent: 'financialNeed' })).toBeTruthy();
    expect(pickDualReply('I feel burnt out and anxious', { chatId: 'test-wellbeing', intent: 'empathy' })).toBeTruthy();
    expect(pickDualReply('Bawo ni?', { chatId: 'test-yoruba' })).toBeTruthy();
  });

  it('exposes populated category pools', () => {
    const stats = getDualBankStats();
    expect(stats.complete).toBe(true);
    expect(stats.categories.sexAdvice).toBeGreaterThan(0);
    expect(stats.categories.relationship).toBeGreaterThan(0);
  });
});
