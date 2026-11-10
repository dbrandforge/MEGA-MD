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
