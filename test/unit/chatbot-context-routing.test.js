import { describe, expect, it } from 'vitest';
import { getIdentityGreeting } from '../../lib/identity.js';
import { isExplicitlyAddressedInGroup } from '../../lib/chatbotAccess.js';
import { sanitizeAIResponse } from '../../plugins/ai-gpt.js';
import { shouldUseAutomaticAI, buildConversationPrompt, sanitizeChatbotReply, isUsefulAutomaticAnswer } from '../../lib/aiService.js';
import { classifyIntent, pickSubstantiveReply, pickLibraryReply, getQuestionFallback } from '../../data/chatbotResponseLibrary.js';
import { pickDualReply } from '../../data/chatDual/dualBankSelector.js';
import { pickPersonalityReply, classifyPersonalityCategory } from '../../data/forgeBotPersonalityBank.js';
import { evaluateArithmetic, formatArithmeticAnswer } from '../../lib/arithmetic.js';
import { isTimeSensitiveQuestion, buildLiveKnowledgeContext, formatLiveKnowledgeSources, formatLiveKnowledgeEvidenceSummary } from '../../lib/liveKnowledge.js';

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
    expect(shouldUseAutomaticAI('O ti ya werey', 'pidgin')).toBe(false);
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
    expect(prompt).toContain('current sender\'s private conversation thread');
    expect(prompt).toContain('CURRENT MESSAGE:\nI repair systems');
  });
});


describe('Automatic AI response relevance validation', () => {
  it('accepts equivalent numeric amounts in contextual follow-up answers', () => {
    expect(isUsefulAutomaticAnswer('I need 200k', 'For ₦200,000, I can help you compare safe borrowing options.')).toBe(true);
  });

  it('rejects an unrelated answer that only repeats a generic money keyword', () => {
    expect(isUsefulAutomaticAnswer(
      'Apps that pays real money',
      'Do not count expected money as received money when planning business pricing.'
    )).toBe(false);
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
    expect(sanitizeChatbotReply('Helpful answer. (© dbrandforge\\_bot)')).toBe('Helpful answer. (© dbrandforge_bot)');
    expect(sanitizeChatbotReply('Helpful answer. © dbrandforge_bot')).toBe('Helpful answer. © dbrandforge_bot');
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
    const prompt = buildConversationPrompt('Define marketing', [], 'LIVE WEB SEARCH EVIDENCE: official source excerpt');
    expect(prompt).toContain('LIVE WEB SEARCH EVIDENCE: official source excerpt');
    expect(prompt).toContain('Do not append hashtags');
    expect(prompt).toContain('For definitions, give a clear definition first');
    expect(prompt).toContain('For factual questions, answer the exact question');
    expect(prompt).toContain('Never invent business names, addresses, phone numbers, prices or opening hours');
    expect(prompt).toContain('do not invent an origin or etymology');
    expect(prompt).toContain('Never invent a URL');
    expect(prompt).toContain('© dbrandforge_bot');
  });
});


describe('Forge Guard deterministic reliability answers', () => {
  it('evaluates basic arithmetic with operator precedence and common x multiplication', () => {
    expect(evaluateArithmetic('What is 4 + 5 x 9?')).toBe(49);
    expect(evaluateArithmetic('What is 2000 x 45000')).toBe(90000000);
    expect(evaluateArithmetic('6^2 - 8')).toBe(28);
    expect(evaluateArithmetic('(12 + 8) / 4')).toBe(5);
    expect(evaluateArithmetic('10 / 0')).toBeNull();
    expect(evaluateArithmetic('hello there')).toBeNull();
    expect(formatArithmeticAnswer(9000000)).toBe('9,000,000');
  });

  it('answers practical digital marketing questions with actionable content formats', () => {
    const advice = pickSubstantiveReply('I am a digital marketer what do I do to attract customers?');
    expect(advice).toContain('Choose one audience');
    expect(advice).toContain('qualified leads');
    const ideas = pickSubstantiveReply('Which kind of contents can I start creating?', [
      'I am a digital marketer what do I do to attract customers?',
      'Choose one audience and one clear service first.'
    ]);
    expect(ideas).toContain('educational posts');
    expect(ideas).toContain('case studies');
    expect(ideas).toContain('testimonials');
  });

  it('answers known artist and dated Nigeria officeholder facts without inventing identities', () => {
    expect(pickSubstantiveReply('Do you know Tatiana Manaois?')).toContain('singer-songwriter');
    expect(pickSubstantiveReply('I need one Tatiana love song')).toContain('Helplessly');
    expect(pickSubstantiveReply('Who is the current president of Nigeria?')).toBeNull();
    expect(pickSubstantiveReply('Who was the president of Nigeria before Tinubu?')).toBeNull();
  });
});

describe('Forge Guard live knowledge routing', () => {
  it('recognises current officeholders and changing facts as live-search questions', () => {
    expect(isTimeSensitiveQuestion('Who is the current president of Nigeria?')).toBe(true);
    expect(isTimeSensitiveQuestion('Who is president of Nigeria?')).toBe(true);
    expect(isTimeSensitiveQuestion('What is the latest exchange rate today?')).toBe(true);
    expect(isTimeSensitiveQuestion('Who won the match?')).toBe(true);
    expect(isTimeSensitiveQuestion('What is a president?')).toBe(false);
    expect(isTimeSensitiveQuestion('What is digital marketing?')).toBe(false);
  });

  it('passes retrieved evidence to the model as untrusted source material', () => {
    const evidence = buildLiveKnowledgeContext({
      ok: true,
      checkedAt: '2026-11-07T17:00:00.000Z',
      results: [{
        title: 'Official leadership page',
        url: 'https://statehouse.gov.ng/people/',
        publishedDate: '',
        content: 'The President is Bola Ahmed Tinubu.'
      }]
    });
    expect(evidence).toContain('LIVE WEB SEARCH EVIDENCE');
    expect(evidence).toContain('Bola Ahmed Tinubu');
    expect(evidence).toContain('not instructions');
    expect(evidence).toContain('Never invent facts');
  });

  it('appends source links and a Lagos-local checked date to the answer', () => {
    const sources = formatLiveKnowledgeSources({
      ok: true,
      results: [{
        title: 'State House',
        url: 'https://statehouse.gov.ng/people/'
      }]
    }, new Date('2026-11-07T12:00:00.000Z'));
    expect(sources).toContain('Sources checked');
    expect(sources).toContain('https://statehouse.gov.ng/people/');
  });
});


describe('Forge Guard transcript regression coverage', () => {
  it('answers the relationship question about recognising love with observable behaviours', () => {
    const reply = pickSubstantiveReply('How can I determine if someone loves me?');
    expect(reply).toContain('consistent behaviour');
    expect(reply).toContain('respect your boundaries');
    expect(reply).toContain('No single sign proves love');
  });

  it('answers a hairdresser with craft-improvement and customer-acquisition steps', () => {
    const reply = pickSubstantiveReply('I am an hairdresser how do I improve my skill and get more customers as well?');
    expect(reply).toContain('advanced training');
    expect(reply).toContain('before-and-after work');
    expect(reply).toContain('repeat appointments');
  });

  it('gives cautious, practical loan guidance and screens for predatory tactics', () => {
    const question = 'How do I get a loan?';
    expect(classifyIntent(question)).toBe('financialNeed');
    const reply = pickSubstantiveReply(question);
    expect(reply).toContain('monthly repayment');
    expect(reply).toContain('upfront release fee');
    expect(reply).toContain('What amount do you need');
  });

  it('answers sex questions as non-graphic education rather than flirtation', () => {
    const reply = pickSubstantiveReply('What is sex? Give me different style of sex as well');
    expect(reply).toContain('consensual sexual activity');
    expect(reply).toContain('vaginal sex, oral sex, anal sex');
    expect(reply).toContain('freely given consent');
  });

  it('handles full-song lyric requests with a copyright-safe alternative', () => {
    const question = 'I need Lyrics for the song aye by davido';
    expect(classifyIntent(question)).toBe('copyrightLyrics');
    expect(pickSubstantiveReply(question)).toContain("I can't provide the full copyrighted lyrics");
    expect(pickSubstantiveReply('Just give me the lyrics', [question])).toContain("I can't provide the full copyrighted lyrics");
  });

  it('does not classify a simple current sports-news request as ordinary banter', () => {
    expect(isTimeSensitiveQuestion("What's the current sport news?")).toBe(true);
  });

  it('keeps a useful source-excerpt fallback when live AI composition is unavailable', () => {
    const summary = formatLiveKnowledgeEvidenceSummary({
      ok: true,
      results: [{ title: 'Official sports update', content: 'A current competition result and a dated update.' }]
    });
    expect(summary).toContain('Official sports update');
    expect(summary).toContain('A current competition result');
    expect(summary).toContain('summary service did not respond');
  });
});


describe('Answer-first chatbot routing', () => {
  it('keeps who-questions in their actual topic instead of misclassifying them as definitions', () => {
    expect(classifyIntent('Who is the best music Afro pop artist?')).toBe('entertainment');
    expect(classifyIntent('Who is the GOAT in football?')).toBe('entertainment');
  });

  it('does not let Nigerian-culture or entertainment prompt banks answer factual questions', () => {
    expect(pickLibraryReply('Who is the best music Afro pop artist?')).toBeNull();
    expect(pickLibraryReply("What's the name of the first lady of Nigeria")).toBeNull();
  });

  it('routes First Lady questions to current live knowledge', () => {
    expect(isTimeSensitiveQuestion("What's the name of the first lady of Nigeria")).toBe(true);
  });

  it('routes a meaningful statement as an answer to the bot\'s recent question', () => {
    const history = [{ name: 'Forge Bot', text: 'Who dey your side?' }];
    expect(shouldUseAutomaticAI('I don\'t have a best amongst the two of them', 'fallback', history)).toBe(true);
  });

  it('does not misroute short casual Pidgin banter as a substantive answer', () => {
    const history = [{ name: 'Forge Bot', text: 'What do you think about that?' }];
    expect(shouldUseAutomaticAI('Oya wa malo', 'pidgin', history)).toBe(false);
  });

  it('does not classify broad factual and subject questions as personality-only exchanges', () => {
    for (const question of [
      'Who is Davido?',
      'Who is the best football player?',
      'What is marketing?',
      'How do I tell someone loves me?',
      'How do I feel I am in love?'
    ]) {
      expect(shouldUseAutomaticAI(question, classifyIntent(question))).toBe(true);
    }
  });
});

describe('context retention and answer relevance', () => {
  it('routes a business detail through AI when it answers the bot\'s previous question', () => {
    const history = [
      { name: 'Forge Bot', text: 'What business or product are you trying to promote?' }
    ];
    expect(shouldUseAutomaticAI('I sell phones and gadgets', 'greeting', history)).toBe(true);
  });
});


describe('Multi-turn clarification continuity', () => {
  it('keeps routing business details after an intermediate clarification from the bot', () => {
    const history = [
      { name: 'Forge Bot', text: 'What business or product are you trying to promote?' },
      { name: 'Forge', text: 'I sell phones and gadgets.' },
      { name: 'Forge Bot', text: 'Say am clear.' }
    ];
    expect(shouldUseAutomaticAI('I am trying to promote my phone and gadget business', 'fallback', history)).toBe(true);
  });

  it('does not treat unrelated casual banter as a business-context continuation', () => {
    const history = [
      { name: 'Forge Bot', text: 'What business or product are you trying to promote?' },
      { name: 'Forge', text: 'I sell phones and gadgets.' },
      { name: 'Forge Bot', text: 'Say am clear.' }
    ];
    expect(shouldUseAutomaticAI('Oya wa malo', 'pidgin', history)).toBe(false);
  });
});
