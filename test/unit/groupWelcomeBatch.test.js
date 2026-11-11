import { describe, expect, it } from 'vitest';
import { buildWelcomeBatchMessage, isMemberAlreadyActive, mergeWelcomeParticipants } from '../../lib/groupWelcomeBatch.js';

describe('shared group welcome batches', () => {
  it('creates one welcome payload that tags every member in a large join batch', () => {
    const participants = Array.from({ length: 125 }, (_, index) => `234800000${String(index).padStart(4, '0')}@s.whatsapp.net`);
    const payload = buildWelcomeBatchMessage(participants, 'Welcome @user');
    expect(payload.mentions).toHaveLength(125);
    expect(payload.text.match(/@/g)).toHaveLength(125);
    expect(payload.text.startsWith('Welcome @2348000000000')).toBe(true);
  });

  it('removes duplicate participant IDs from a single welcome payload', () => {
    const payload = buildWelcomeBatchMessage(['123@s.whatsapp.net', '123@s.whatsapp.net'], 'Hello @user');
    expect(payload.mentions).toEqual(['123@s.whatsapp.net']);
    expect(payload.text).toBe('Hello @123');
  });

  it('coalesces multiple participant-update events into one deduplicated join batch', () => {
    const first = Array.from({ length: 60 }, (_, index) => `234800000${String(index).padStart(4, '0')}@s.whatsapp.net`);
    const second = Array.from({ length: 65 }, (_, index) => `234800000${String(index + 60).padStart(4, '0')}@s.whatsapp.net`);
    const merged = mergeWelcomeParticipants(first, [...second, first[0]]);
    expect(merged).toHaveLength(125);
    expect(buildWelcomeBatchMessage(merged, 'Welcome @user').mentions).toHaveLength(125);
  });

  it('recognizes a participant-update retry for someone already active', () => {
    expect(isMemberAlreadyActive({ everJoined: true, status: 'active' })).toBe(true);
    expect(isMemberAlreadyActive({ everJoined: true, status: 'inactive' })).toBe(false);
    expect(isMemberAlreadyActive({ everJoined: false, status: 'active' })).toBe(false);
  });
});


describe('fixed-window welcome batching and introduction reminder eligibility', () => {
  it('keeps the original three-minute flush deadline when more join events arrive', async () => {
    const { createOrExtendWelcomeBatch } = await import('../../lib/groupWelcomeBatch.js');
    const first = createOrExtendWelcomeBatch(null, ['one@s.whatsapp.net'], 1000, 180000, 'batch-1');
    const extended = createOrExtendWelcomeBatch(first, ['two@s.whatsapp.net'], 61000, 180000, 'batch-2');
    expect(first.flushAt).toBe(181000);
    expect(extended.flushAt).toBe(181000);
    expect(extended.participants.map(x => x)).toEqual(['one@s.whatsapp.net', 'two@s.whatsapp.net']);
  });

  it('starts a fresh fixed window after the previous batch has expired', async () => {
    const { createOrExtendWelcomeBatch } = await import('../../lib/groupWelcomeBatch.js');
    const first = createOrExtendWelcomeBatch(null, ['one@s.whatsapp.net'], 1000, 180000, 'batch-1');
    const next = createOrExtendWelcomeBatch(first, ['two@s.whatsapp.net'], 181001, 180000, 'batch-2');
    expect(next.batchId).toBe('batch-2');
    expect(next.flushAt).toBe(361001);
    expect(next.participants).toHaveLength(1);
  });

  it('reminds only members who have individually reached ten minutes', async () => {
    const { getEligibleIntroReminderEntries, getNextIntroReminderAt } = await import('../../lib/groupWelcomeBatch.js');
    const now = 700000;
    const pending = {
      'early@s.whatsapp.net': { joinedAt: now - 600000, reminded: false },
      'recent@s.whatsapp.net': { joinedAt: now - 120000, reminded: false },
      'done@s.whatsapp.net': { joinedAt: now - 900000, reminded: true },
      'inactive@s.whatsapp.net': { joinedAt: now - 900000, status: 'inactive' }
    };
    expect(getEligibleIntroReminderEntries(pending, now).map(([jid]) => jid)).toEqual(['early@s.whatsapp.net']);
    expect(getNextIntroReminderAt(pending)).toBe(now - 120000 + 600000);
  });
});
