import { describe, expect, it } from 'vitest';
import { getIdentityGreeting } from '../../lib/identity.js';
import { isExplicitlyAddressedInGroup } from '../../lib/chatbotAccess.js';
import { sanitizeAIResponse } from '../../plugins/ai-gpt.js';
import { shouldUseAutomaticAI } from '../../lib/aiService.js';
import { classifyIntent, pickSubstantiveReply, getQuestionFallback } from '../../data/chatbotResponseLibrary.js';
import { pickPersonalityReply, classifyPersonalityCategory } from '../../data/forgeBotPersonalityBank.js';

const creator = { role: 'creator', name: 'Forge dcreative', alias: 'Forge' };
const historyWith = text => [{ name: 'Forge Bot', text, at: Date.now() }];

describe('Forge Guard contextual response selection', () => {
  it('reserves Creator arrival greetings for direct calls, not insults containing bot', () => {
    expect(getIdentityGreeting('Bot', creator)).toBeTruthy();
    expect(getIdentityGreeting('Werey bot', creator)).toBeNull();
  });

  it('routes an insult containing bot to the savage response bank', () => {
    expect(classifyPersonalityCategory('Werey bot')).toBe('savage');
    const reply = pickPersonalityReply('Werey bot', { chatId: 'test-group' });
    expect(reply).toBeTruthy();
  });

  it('recognises a greeting such as what is popping', () => {
    expect(classifyPersonalityCategory("What's popping")).toBe('greeting');
    const reply = pickPersonalityReply("What's popping", { chatId: 'test-group' });
    expect(reply).toBeTruthy();
  });

  it('acknowledges a positive answer to the bot asking how the user is', () => {
    expect(classifyPersonalityCategory("I'm good", { history: historyWith('Good enough to gist. What\'s up?') })).toBe('wellbeingAcknowledgement');
    const reply = pickPersonalityReply("I'm good", {
      chatId: 'test-group',
      history: historyWith('Good enough to gist. What\'s up?')
    });
    expect(reply).toBeTruthy();
  });

  it('continues an affirmative relationship follow-up with context', () => {
    expect(classifyPersonalityCategory("Yes there's", { history: historyWith('Could there be a misunderstanding worth clearing up?') })).toBe('affirmativeFollowup');
    const reply = pickPersonalityReply("Yes there's", {
      chatId: 'test-group',
      history: historyWith('Could there be a misunderstanding worth clearing up?')
    });
    expect(reply).toBeTruthy();
  });

  it('respects a user declining to share more instead of issuing a generic fallback', () => {
    expect(classifyPersonalityCategory('Nothing for you', { history: historyWith('Oya, give me the backstory.') })).toBe('decline');
    const reply = pickPersonalityReply('Nothing for you', {
      chatId: 'test-group',
      history: historyWith('Oya, give me the backstory.')
    });
    expect(reply).toBeTruthy();
  });
});

describe('Group chatbot addressing boundary', () => {
  it('does not answer ordinary group conversation or the word bot alone', () => {
    expect(isExplicitlyAddressedInGroup({ isMention: false, isReply: false })).toBe(false);
  });

  it('answers when mentioned or when the quoted message was authored by the bot', () => {
    expect(isExplicitlyAddressedInGroup({ isMention: true })).toBe(true);
    expect(isExplicitlyAddressedInGroup({
      quotedParticipant: '2348012345678:4@s.whatsapp.net',
      botJids: ['2348012345678@s.whatsapp.net']
    })).toBe(true);
  });

  it('does not answer replies to another participant or ordinary game messages', () => {
    expect(isExplicitlyAddressedInGroup({
      quotedParticipant: '2348098765432@s.whatsapp.net',
      botJids: ['2348012345678@s.whatsapp.net']
    })).toBe(false);
    expect(isExplicitlyAddressedInGroup({ isMention: false })).toBe(false);
  });
});

describe('GPT legacy identity sanitization', () => {
  it('removes the previous repository author when the model uses it as an unsolicited name', () => {
    expect(sanitizeAIResponse("You've got this, Qasim.", 'What is 2 + 2?')).toBe("You've got this.");
    expect(sanitizeAIResponse("Qasim, you've got this.", 'What is 2 + 2?')).toBe("you've got this.");
  });

  it('does not rewrite an explicitly requested factual question about that person', () => {
    expect(sanitizeAIResponse('Qasim Ali created the original repository.', 'Who is Qasim Ali?')).toBe('Qasim Ali created the original repository.');
  });
});


describe('Automatic AI opt-in routing', () => {
  it('limits automatic AI to substantive advice intents or full fallback questions', () => {
    expect(shouldUseAutomaticAI('Can two people love each other?', 'relationships')).toBe(true);
    expect(shouldUseAutomaticAI('What makes someone genuinely interesting to talk to?', 'fallback')).toBe(true);
    expect(shouldUseAutomaticAI('Hello bot', 'greeting')).toBe(false);
    expect(shouldUseAutomaticAI('What?', 'fallback')).toBe(false);
  });
});


describe('Substantive chatbot question routing', () => {
  it('classifies love and compatibility questions as relationship intent', () => {
    expect(classifyIntent('Can two people love each other and still be incompatible?')).toBe('relationships');
    expect(classifyIntent('How can I fall in love?')).toBe('relationships');
    expect(classifyIntent('What is love?')).toBe('definition');
  });

  it('answers the compatibility question with a direct, reasoned distinction', () => {
    const reply = pickSubstantiveReply('Can two people love each other and still be incompatible?');
    expect(reply).toMatch(/^Yes\./);
    expect(reply).toContain('values, needs, communication styles');
    expect(reply).toContain('respected, secure');
  });

  it('answers how to fall in love without suggesting it can be forced', () => {
    const reply = pickSubstantiveReply('How can I fall in love?');
    expect(reply).toContain('cannot force yourself');
    expect(reply).toContain('trust and affection');
    expect(reply).toContain('mutual');
  });

  it('does not replace the established love definition with a different answer', () => {
    expect(pickSubstantiveReply('What is love?')).toBeNull();
  });

  it('uses a question-aware fallback instead of unrelated banter for unknown questions', () => {
    expect(getQuestionFallback('What makes someone genuinely interesting to talk to?')).toContain('addresses the question');
    expect(getQuestionFallback('Hello bot')).toBeNull();
  });
});
