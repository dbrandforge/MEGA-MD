import { describe, expect, it } from 'vitest';
import { isUsefulAutomaticAnswer, buildConversationPrompt, shouldUseLiveSearchForMessage } from '../../lib/aiService.js';

describe('Forge Guard conversation style instructions', () => {
  it('does not steer casual conversations toward business by default', () => {
    const prompt = buildConversationPrompt('I came to check if you are alive');
    expect(prompt).toContain('Do not assume every conversation is about business');
    expect(prompt).toContain('Do not end every reply with a question');
  });

  it('uses individual preferences and keeps group context scoped', () => {
    const prompt = buildConversationPrompt('How far?', [], 'GROUP CONVERSATION MODE: MATURED MINDED.');
    expect(prompt).toContain('Adapt to the individual using confirmed profile preferences');
    expect(prompt).toContain('Do not infer personality, sexual interests or comfort from gender or stereotypes');
    expect(prompt).toContain('Matured Minded is adult-oriented');
  });
});

describe('Gemini automatic-answer relevance checks', () => {
  it('accepts an examples answer even when the first word of the question is not repeated', () => {
    const answer = 'Examples of plants that use photosynthesis include maize, rice, tomato, beans, mango trees and grasses. They use sunlight, water and carbon dioxide to make sugars for growth.';
    expect(isUsefulAutomaticAnswer('Example of plants that benefit from this are?', answer)).toBe(true);
  });

  it('accepts a concise list of marketing processes', () => {
    const answer = 'The main processes include market research, segmentation, targeting, positioning, product planning, pricing, promotion, distribution and performance evaluation.';
    expect(isUsefulAutomaticAnswer('Proces involved in marketing are?', answer)).toBe(true);
  });

  it('continues to reject explicit non-answers and filler', () => {
    expect(isUsefulAutomaticAnswer('What is photosynthesis?', "I couldn't produce a reliable answer to that just now. Please try again shortly.")).toBe(false);
    expect(isUsefulAutomaticAnswer('What is marketing?', 'Interesting, tell me more about what you mean.')).toBe(false);
  });

  it('treats Nigerian conversational greetings as banter, including tagged messages', () => {
    expect(isUsefulAutomaticAnswer('My guy how far', 'I dey alright, my guy. How body?')).toBe(true);
    expect(isUsefulAutomaticAnswer('@The BrandForge what\'s popping', 'All good here, my guy. What\'s happening with you?')).toBe(true);
  });

  it('accepts developed answers that explain a factual question semantically', () => {
    const answer = 'Photosynthesis is how green plants make their own food. Their leaves capture light energy and use it to turn water and carbon dioxide into sugar, releasing oxygen in the process.';
    expect(isUsefulAutomaticAnswer('Explain how plants make food?', answer)).toBe(true);
  });
});

describe('Sticker reaction mode', () => {
  it('never routes sticker-originated turns through live web search', () => {
    expect(shouldUseLiveSearchForMessage({ mediaType: 'sticker' })).toBe(false);
    expect(shouldUseLiveSearchForMessage({ mediaType: 'voice' })).toBe(true);
    expect(shouldUseLiveSearchForMessage({})).toBe(true);
  });

  it('instructs sticker replies to be brief, contextual and free of citations or URLs', () => {
    const prompt = buildConversationPrompt('The user sent a sticker. Visual description: a surprised cartoon face.', [], '', 'english', 'sticker');
    expect(prompt).toContain('STICKER REACTION MODE (MANDATORY)');
    expect(prompt).toContain('Respond to the person as if they had made a conversational remark');
    expect(prompt).toContain('Do not perform web research');
    expect(prompt).toContain('or include URLs');
    expect(prompt).toContain('usually one natural sentence');
    expect(prompt).toContain('Never say “this sticker shows”');
    expect(prompt).toContain('Respond to the person as if they had made a conversational remark');
  });

  it('keeps normal conversational prompts unchanged', () => {
    const prompt = buildConversationPrompt('What is marketing?');
    expect(prompt).not.toContain('STICKER REACTION MODE');
  });
});
