import { describe, expect, it } from 'vitest';
import { getIdentityGreeting } from '../../lib/identity.js';
import { isExplicitlyAddressedInGroup } from '../../lib/chatbotAccess.js';
import { sanitizeAIResponse } from '../../plugins/ai-gpt.js';
import { shouldUseAutomaticAI, buildConversationPrompt, sanitizeChatbotReply } from '../../lib/aiService.js';
import { classifyIntent, pickSubstantiveReply, pickLibraryReply, getQuestionFallback } from '../../data/chatbotResponseLibrary.js';
import { pickDualReply } from '../../data/chatDual/dualBankSelector.js';
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
  it('routes meaningful conversation and short questions to contextual AI while retaining instant one-word banter', () => {
    expect(shouldUseAutomaticAI('Can two people love each other?', 'relationships')).toBe(true);
    expect(shouldUseAutomaticAI('What makes someone genuinely interesting to talk to?', 'fallback')).toBe(true);
    expect(shouldUseAutomaticAI('I repair systems', 'fallback')).toBe(true);
    expect(shouldUseAutomaticAI('O ti ya werey', 'pidgin')).toBe(true);
    expect(shouldUseAutomaticAI('Why?', 'followup')).toBe(true);
    expect(shouldUseAutomaticAI('Werey', 'savage')).toBe(false);
    expect(shouldUseAutomaticAI('😂', 'reaction')).toBe(false);
    expect(shouldUseAutomaticAI('   ', 'fallback')).toBe(false);
  });

  it('builds a contextual Forge Guard prompt with recent speaker-labelled turns and personality rules', () => {
    const prompt = buildConversationPrompt('I repair systems', [
      { name: 'Forge dcreative', text: 'What can I do to make money?' },
      { name: 'Forge Bot', text: 'Tell me your skills and I can narrow it down.' }
    ]);
    expect(prompt).toContain('Forge dcreative: What can I do to make money?');
    expect(prompt).toContain('Forge Bot: Tell me your skills');
    expect(prompt).toContain('A skill or profession is not a sexual innuendo');
    expect(prompt).toContain('Nigerian English, Nigerian Pidgin');
    expect(prompt).toContain('CURRENT MESSAGE:\nI repair systems');
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


  it('keeps the love definition ahead of relationship banks even after relationship context', () => {
    expect(classifyIntent('What is love?')).toBe('definition');
    expect(pickLibraryReply('What is love?', 'Do not turn assistance into proof of love;')).toContain('deep feeling of care, respect, affection and commitment');
    expect(pickDualReply('What is love?', {
      intent: 'definition',
      context: ['How can I fall in love?', 'Can two people love each other and still be incompatible?']
    })).toBeNull();
  });

  it('recognises practical money-making questions and selects a financial answer', () => {
    const question = 'What can I do to make money?';
    expect(classifyIntent(question)).toBe('financialNeed');
    expect(pickSubstantiveReply(question)).toMatch(/sell a service|commission-based sales|10 likely customers/i);
    expect(pickLibraryReply('I need money urgently')).toMatch(/money|amount|deadline|cash|task|how much|no judgement/i);
  });

  it('does not let old topic context hijack a fresh slang or banter message', () => {
    expect(pickDualReply('Omo aaale', {
      intent: 'pidgin',
      context: ['What can I do to make money?', 'How can I fall in love?']
    })).toBeNull();
    expect(classifyPersonalityCategory('Omo aaale')).toBe('pidgin');
    expect(pickPersonalityReply('Omo aaale', { chatId: 'test-group' })).toBeTruthy();
  });

  it('still carries context for explicit follow-up wording', () => {
    expect(pickDualReply('Why?', {
      intent: 'followup',
      context: ['The relationship needs consistency and mutual respect.']
    })).toBeTruthy();
  });

  it('uses a question-aware fallback instead of unrelated banter for unknown questions', () => {
    expect(getQuestionFallback('What makes someone genuinely interesting to talk to?')).toContain('addresses the question');
    expect(getQuestionFallback('Hello bot')).toBeNull();
  });
});


describe('Forge Guard clean output and refined AI routing', () => {
  it('removes hashtags from any chatbot response without adding a branded footer', () => {
    expect(sanitizeChatbotReply('The answer is 28. #Maths #ForgeGuard')).toBe('The answer is 28.');
    expect(sanitizeChatbotReply('Good one 😂\n#banter')).toBe('Good one 😂');
    expect(sanitizeChatbotReply('A clean reply.')).toBe('A clean reply.');
  });

  it('routes information requests and personal skill statements to contextual AI', () => {
    expect(shouldUseAutomaticAI('Define marketing', 'definition')).toBe(true);
    expect(shouldUseAutomaticAI('Who is the current president of Nigeria?', 'fallback')).toBe(true);
    expect(shouldUseAutomaticAI('I repair systems', 'fallback')).toBe(true);
    expect(shouldUseAutomaticAI('How do I attract the right customers?', 'fallback')).toBe(true);
  });

  it('routes short follow-ups only when prior conversation exists', () => {
    const history = [{ name: 'Forge Bot', text: 'I can explain why that works.' }];
    expect(shouldUseAutomaticAI('Yes please', 'agreement', history)).toBe(true);
    expect(shouldUseAutomaticAI('Yes please', 'agreement', [])).toBe(false);
    expect(shouldUseAutomaticAI('Why?', 'followup')).toBe(true);
  });

  it('keeps standalone slang and casual banter on the fast local path', () => {
    expect(shouldUseAutomaticAI('O ti ya werey', 'pidgin')).toBe(false);
    expect(shouldUseAutomaticAI('Oya wa malo', 'pidgin')).toBe(false);
    expect(shouldUseAutomaticAI('Werey 😂', 'savage')).toBe(false);
    expect(shouldUseAutomaticAI('😂', 'reaction')).toBe(false);
  });

  it('instructs the model to avoid hashtags and answer factual, definition and link requests directly', () => {
    const prompt = buildConversationPrompt('Define marketing', []);
    expect(prompt).toContain('Do not append hashtags');
    expect(prompt).toContain('For definitions, give a clear definition first');
    expect(prompt).toContain('For factual questions, answer the exact question');
    expect(prompt).toContain('Never invent a URL');
    expect(prompt).toContain('© dbrandforge_bot');
  });
});
