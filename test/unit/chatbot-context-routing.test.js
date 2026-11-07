import { describe, expect, it } from 'vitest';
import { getIdentityGreeting } from '../../lib/identity.js';
import { personalityBank, pickPersonalityReply } from '../../data/forgeBotPersonalityBank.js';

const creator = { role: 'creator', name: 'Forge dcreative', alias: 'Forge' };
const historyWith = text => [{ name: 'Forge Bot', text, at: Date.now() }];

describe('Forge Guard contextual response selection', () => {
  it('reserves Creator arrival greetings for direct calls, not insults containing bot', () => {
    expect(getIdentityGreeting('Bot', creator)).toBeTruthy();
    expect(getIdentityGreeting('Werey bot', creator)).toBeNull();
  });

  it('routes an insult containing bot to the savage response bank', () => {
    const reply = pickPersonalityReply('Werey bot', { chatId: 'test-group' });
    expect(personalityBank.savage).toContain(reply);
  });

  it('recognises a greeting such as what is popping', () => {
    const reply = pickPersonalityReply("What's popping", { chatId: 'test-group' });
    expect(personalityBank.greeting).toContain(reply);
  });

  it('acknowledges a positive answer to the bot asking how the user is', () => {
    const reply = pickPersonalityReply("I'm good", {
      chatId: 'test-group',
      history: historyWith('Good enough to gist. What\'s up?')
    });
    expect(personalityBank.wellbeingAcknowledgement).toContain(reply);
  });

  it('continues an affirmative relationship follow-up with context', () => {
    const reply = pickPersonalityReply("Yes there's", {
      chatId: 'test-group',
      history: historyWith('Could there be a misunderstanding worth clearing up?')
    });
    expect(personalityBank.affirmativeFollowup).toContain(reply);
  });

  it('respects a user declining to share more instead of issuing a generic fallback', () => {
    const reply = pickPersonalityReply('Nothing for you', {
      chatId: 'test-group',
      history: historyWith('Oya, give me the backstory.')
    });
    expect(personalityBank.decline).toContain(reply);
  });
});
