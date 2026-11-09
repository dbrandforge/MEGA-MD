import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/lightweight_store.js', () => ({
  default: {
    getSetting: vi.fn(async () => ({ '234800000000@s.whatsapp.net': { introduced: false } })),
    saveSetting: vi.fn(async () => {})
  }
}));
vi.mock('../../lib/groupFeatureAccess.js', () => ({
  hasMaturedMindedFeatures: vi.fn(async () => true)
}));
vi.mock('../../plugins/welcomelog.js', () => ({ logWelcome: vi.fn(async () => {}) }));

import store from '../../lib/lightweight_store.js';
import { looksLikeMemberIntroduction, markMemberIntroduced } from '../../plugins/sincity-welcome.js';

describe('pending introduction tracking', () => {
  beforeEach(() => vi.clearAllMocks());

  it('recognizes an introduction containing identity and profile details', () => {
    expect(looksLikeMemberIntroduction(
      'My name is Ada. I am from Lagos, single, and looking for good conversations.'
    )).toBe(true);
  });

  it('does not treat casual group chat as an introduction', () => {
    expect(looksLikeMemberIntroduction('Omo, this group is funny. How far everyone?')).toBe(false);
    expect(looksLikeMemberIntroduction('.gender lady')).toBe(false);
  });

  it('keeps a member pending after ordinary messages', async () => {
    await expect(markMemberIntroduced(
      '120363000000000000@g.us',
      '234800000000@s.whatsapp.net',
      'Good evening everyone.'
    )).resolves.toBe(false);
    expect(store.saveSetting).not.toHaveBeenCalled();
  });

  it('clears pending status only after an actual introduction', async () => {
    await expect(markMemberIntroduced(
      '120363000000000000@g.us',
      '234800000000@s.whatsapp.net',
      'My name is Ada. I am based in Lagos and I work in technology.'
    )).resolves.toBe(true);
    expect(store.saveSetting).toHaveBeenCalledWith(
      '120363000000000000@g.us',
      'pendingIntros_v2',
      {}
    );
  });
});
