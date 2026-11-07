import { describe, expect, it } from 'vitest';
import {
  MATURED_MIND_EXCLUSIVE_MAPS,
  GENERAL_GROUP_MAPS,
  MATURED_MIND_EXCLUSIVE_SETTINGS,
  GENERAL_GROUP_SETTINGS,
  MATURED_MIND_EXCLUSIVE_FEATURES,
  GENERAL_GROUP_FEATURES,
  copyGroupUserData,
  copyGroupSettings,
  copyAntispamGroupConfig
} from '../../lib/groupFeatureProfile.js';
import { isMaturedMindedPackageEnabled } from '../../lib/groupFeatureProfile.js';

const source = 'source@g.us';
const target = 'target@g.us';

describe('Matured Minded and general group feature packages', () => {
  it('keeps the exclusive welcome/lifecycle settings separate from general switches', () => {
    expect(MATURED_MIND_EXCLUSIVE_MAPS).toEqual(['welcome', 'goodbye']);
    expect(GENERAL_GROUP_MAPS).toEqual(['chatbot', 'antilink', 'antibadword', 'antitag']);
    expect(MATURED_MIND_EXCLUSIVE_FEATURES).toContain('Three-message welcome pack and group rules');
    expect(GENERAL_GROUP_FEATURES).toContain('Group chatbot');
  });

  it('copies only the requested Matured Minded-exclusive user maps', () => {
    const input = {
      chatbot: { [source]: true },
      welcome: { [source]: { enabled: true, message: 'Welcome {user}' } },
      goodbye: { [source]: { enabled: true } },
      warnings: { [source]: { 'user@s.whatsapp.net': 3 } },
      sudo: ['creator@s.whatsapp.net'],
      chatbotDM: { 'user@s.whatsapp.net': true }
    };
    const result = copyGroupUserData(input, source, target, MATURED_MIND_EXCLUSIVE_MAPS);
    expect(result.welcome[target]).toEqual({ enabled: true, message: 'Welcome {user}' });
    expect(result.goodbye[target]).toEqual({ enabled: true });
    expect(result.chatbot).toEqual(input.chatbot);
    expect(result.warnings).toEqual(input.warnings);
    expect(result.sudo).toEqual(input.sudo);
    expect(result.chatbotDM).toEqual(input.chatbotDM);
  });

  it('copies only general user switches without overwriting the exclusive welcome maps', () => {
    const input = {
      chatbot: { [source]: true },
      welcome: { [source]: { enabled: true, message: 'Welcome {user}' } },
      antilink: { [source]: true },
      antibadword: { [source]: true },
      antitag: { [source]: true }
    };
    const result = copyGroupUserData(input, source, target, GENERAL_GROUP_MAPS);
    expect(result.chatbot[target]).toBe(true);
    expect(result.antilink[target]).toBe(true);
    expect(result.antibadword[target]).toBe(true);
    expect(result.antitag[target]).toBe(true);
    expect(result.welcome).toEqual(input.welcome);
  });

  it('copies only approved general settings, never live game/session state', () => {
    const result = copyGroupSettings({
      anonymousState: { enabled: true },
      antilink: { enabled: true, action: 'delete' },
      manualGameLocks: {},
      hangmanGame: { status: 'active', word: 'secret' },
      groupMemberHistory: { 'person@lid': { everJoined: true } },
      chatbotConversationMemory: [{ text: 'private chat' }]
    }, GENERAL_GROUP_SETTINGS);
    expect(result).toEqual({
      anonymousState: { enabled: true },
      antilink: { enabled: true, action: 'delete' },
      manualGameLocks: {}
    });
    expect(MATURED_MIND_EXCLUSIVE_SETTINGS).toEqual([]);
  });

  it('copies the antispam group profile without copying other groups', () => {
    const result = copyAntispamGroupConfig({
      groups: { [source]: { enabled: true, maxMessages: 5, windowSeconds: 10, action: 'warn', warnCount: 3 } }
    }, source, target);
    expect(result.groups[target]).toEqual({ enabled: true, maxMessages: 5, windowSeconds: 10, action: 'warn', warnCount: 3 });
    expect(result.groups[source]).toBeDefined();
  });
});

describe('Matured Minded exclusive package access', () => {
  it('always preserves the source group and requires explicit package enablement elsewhere', () => {
    expect(isMaturedMindedPackageEnabled('primary@g.us', null, 'primary@g.us')).toBe(true);
    expect(isMaturedMindedPackageEnabled(target, { featureSets: { maturedMinded: true, general: false } }, 'primary@g.us')).toBe(true);
    expect(isMaturedMindedPackageEnabled(target, { featureSets: { maturedMinded: false, general: true } }, 'primary@g.us')).toBe(false);
    expect(isMaturedMindedPackageEnabled(target, null, 'primary@g.us')).toBe(false);
  });

  it('preserves both packages when general settings are copied after exclusive settings', () => {
    const original = {
      welcome: { [source]: { enabled: true, message: 'Welcome {user}' } },
      goodbye: { [source]: { enabled: true } },
      chatbot: { [source]: true },
      antilink: { [source]: true }
    };
    const exclusiveApplied = copyGroupUserData(original, source, target, MATURED_MIND_EXCLUSIVE_MAPS);
    const bothApplied = copyGroupUserData(exclusiveApplied, source, target, GENERAL_GROUP_MAPS);
    expect(bothApplied.welcome[target]).toEqual({ enabled: true, message: 'Welcome {user}' });
    expect(bothApplied.goodbye[target]).toEqual({ enabled: true });
    expect(bothApplied.chatbot[target]).toBe(true);
    expect(bothApplied.antilink[target]).toBe(true);
  });
});
