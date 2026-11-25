import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { state } = vi.hoisted(() => ({ state: new Map() }));
vi.mock('../../lib/lightweight_store.js', () => ({
  default: {
    getSetting: vi.fn(async (chatId, key) => state.get(`${chatId}:${key}`) || {}),
    saveSetting: vi.fn(async (chatId, key, value) => { state.set(`${chatId}:${key}`, value); })
  }
}));
vi.mock('../../lib/groupFeatureAccess.js', () => ({
  hasMaturedMindedFeatures: vi.fn(async () => true)
}));
vi.mock('../../plugins/welcomelog.js', () => ({ logWelcome: vi.fn(async () => {}) }));

import store from '../../lib/lightweight_store.js';
import { groupRules } from '../../data/welcomeData.js';
import { handleNewMember, sendWelcomePack } from '../../plugins/sincity-welcome.js';

describe('batch member welcome and intro reminders', () => {
  const chatId = '120363000000000000@g.us';
  const members = [
    '234800000001@s.whatsapp.net',
    '234800000002@s.whatsapp.net',
    '234800000003@s.whatsapp.net'
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    state.clear();
  });

  afterEach(() => vi.useRealTimers());

  it('sends exactly two shared welcome messages and one reminder tagging all pending members', async () => {
    const sock = { sendMessage: vi.fn(async () => ({ key: { id: 'sent' } })) };
    const task = handleNewMember(sock, chatId, members);
    await vi.advanceTimersByTimeAsync(2000);
    await task;

    const welcomeMessages = sock.sendMessage.mock.calls.map(([, payload]) => payload);
    const taggedWelcome = welcomeMessages.filter(payload =>
      Array.isArray(payload.mentions) && payload.mentions.length === members.length
    );
    expect(taggedWelcome).toHaveLength(2);
    expect(taggedWelcome[0].mentions).toEqual(members);
    expect(taggedWelcome[1].mentions).toEqual(members);
    expect(taggedWelcome[0].text).toContain('Kindly introduce yourself properly');
    expect(taggedWelcome[1].text).toContain(groupRules);
    expect(taggedWelcome[1].text).toContain("TODAY'S ACTIVITY");

    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    const allMessages = sock.sendMessage.mock.calls.map(([, payload]) => payload);
    const reminder = allMessages.find(payload => payload.text?.includes('please complete your introduction'));
    expect(reminder).toBeTruthy();
    expect(reminder.mentions).toEqual(members);

    const pending = await store.getSetting(chatId, 'pendingIntros_v2');
    expect(Object.keys(pending)).toHaveLength(3);
    expect(Object.values(pending).every(record => record.reminded === true)).toBe(true);
  });

  it('manual welcome sends exactly two messages and tags the requested member in both', async () => {
    const sock = { sendMessage: vi.fn(async () => ({ key: { id: 'sent' } })) };
    const task = sendWelcomePack(sock, chatId, [members[0]]);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await task;
    expect(result).toMatchObject({ sent: true, count: 1 });
    expect(sock.sendMessage).toHaveBeenCalledTimes(2);
    for (const [, payload] of sock.sendMessage.mock.calls) {
      expect(payload.mentions).toEqual([members[0]]);
    }
  });
});
