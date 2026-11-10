import { describe, expect, it } from 'vitest';
import { isUsefulAutomaticAnswer } from '../../lib/aiService.js';

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
