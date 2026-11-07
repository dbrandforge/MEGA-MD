import { describe, expect, it } from 'vitest';
import {
  copyGroupUserData,
  copyGroupSettings,
  copyAntispamGroupConfig
} from '../../lib/groupFeatureProfile.js';

const source = 'source@g.us';
const target = 'target@g.us';

describe('Mature Minded group feature profile', () => {
  it('copies feature switches and welcome configuration without copying unrelated user data', () => {
    const input = {
      chatbot: { [source]: true },
      welcome: { [source]: { enabled: true, message: 'Welcome {user}' } },
      goodbye: {},
      warnings: { [source]: { 'user@s.whatsapp.net': 3 } },
      sudo: ['creator@s.whatsapp.net'],
      chatbotDM: { 'user@s.whatsapp.net': true }
    };
    const result = copyGroupUserData(input, source, target);
    expect(result.chatbot[target]).toBe(true);
    expect(result.welcome[target]).toEqual({ enabled: true, message: 'Welcome {user}' });
    expect(result.warnings).toEqual(input.warnings);
    expect(result.sudo).toEqual(input.sudo);
    expect(result.chatbotDM).toEqual(input.chatbotDM);
  });

  it('copies only approved persistent feature settings, never live game/session state', () => {
    const result = copyGroupSettings({
      anonymousState: { enabled: true },
      antilink: { enabled: true, action: 'delete' },
      manualGameLocks: {},
      hangmanGame: { status: 'active', word: 'secret' },
      groupMemberHistory: { 'person@lid': { everJoined: true } },
      chatbotConversationMemory: [{ text: 'private chat' }]
    });
    expect(result).toEqual({
      anonymousState: { enabled: true },
      antilink: { enabled: true, action: 'delete' },
      manualGameLocks: {}
    });
  });

  it('copies the antispam group profile without copying other groups', () => {
    const result = copyAntispamGroupConfig({
      groups: { [source]: { enabled: true, maxMessages: 5, windowSeconds: 10, action: 'warn', warnCount: 3 } }
    }, source, target);
    expect(result.groups[target]).toEqual({ enabled: true, maxMessages: 5, windowSeconds: 10, action: 'warn', warnCount: 3 });
    expect(result.groups[source]).toBeDefined();
  });
});
