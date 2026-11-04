import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  dualExpansionStats,
  dualBankExpansionComplete,
} from '../../data/chatDual/chatDual_expansion_index.js';
import { pickDualReply, getDualBankStats } from '../../data/chatDual/dualBankSelector.js';

describe('ChatDual expansion bank', () => {
  it('reports complete and exact 5183 pairs', () => {
    assert.equal(dualBankExpansionComplete, true);
    const s = dualExpansionStats();
    assert.equal(s.total, 5183);
    assert.equal(s.core, 175);
    assert.equal(s.expand, 2908);
    assert.equal(s.yoruba, 400);
    assert.equal(s.conversational, 500);
    assert.equal(s.gist, 375);
    assert.equal(s.financialNeed, 375);
    assert.equal(s.relationshipExtra, 450);
  });

  it('routes sexual-health advice to dual, not null', () => {
    const r = pickDualReply('Is continuous consent required during a scene?', { chatId: 't1' });
    assert.ok(typeof r === 'string' && r.length > 5);
  });

  it('leaves pure dirty talk to personality bank (null dual)', () => {
    const r = pickDualReply('talk dirty to me', { chatId: 't2' });
    assert.equal(r, null);
  });

  it('routes relationship / money / wellbeing / yoruba', () => {
    assert.ok(pickDualReply('My situationship only texts at night', { chatId: 't3' }));
    assert.ok(pickDualReply('I need money urgently', { chatId: 't4', intent: 'financialNeed' }));
    assert.ok(pickDualReply('I feel burnt out and anxious', { chatId: 't5', intent: 'empathy' }));
    assert.ok(pickDualReply('Bawo ni?', { chatId: 't6' }));
  });

  it('exposes category pools', () => {
    const stats = getDualBankStats();
    assert.ok(stats.categories.sexAdvice > 0);
    assert.ok(stats.categories.relationship > 0);
  });
});
