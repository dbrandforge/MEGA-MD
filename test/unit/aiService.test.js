import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { isUsefulAutomaticAnswer, buildConversationPrompt, buildFallbackPrompt, shouldUseLiveSearchForMessage, askFastAI, interpretCreatorCommand } from '../../lib/aiService.js';

vi.mock('axios', () => ({ default: { post: vi.fn(), get: vi.fn() } }));

describe('bounded automatic AI provider failover', () => {
  const originalKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-gemini-key';
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  });

  it('falls through to the first backup when Gemini times out', async () => {
    axios.post.mockRejectedValueOnce(Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }));
    axios.get.mockResolvedValueOnce({ data: { data: { response: 'Photosynthesis is the process by which green plants use sunlight to make food from water and carbon dioxide.' } } });

    const answer = await askFastAI('What is photosynthesis?', { timeoutMs: 5000 });

    expect(answer).toContain('Photosynthesis');
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get.mock.calls[0][1].timeout).toBeLessThanOrEqual(1100);
    expect(axios.get.mock.calls[0][0].length).toBeLessThan(12000);
  });


  it('caps simultaneous automatic AI requests to protect the bot process', async () => {
    const pending = [];
    axios.post.mockImplementation(() => new Promise(resolve => pending.push(() => resolve({
      data: { candidates: [{ content: { parts: [{ text: 'Photosynthesis is how green plants use sunlight to make food from water and carbon dioxide.' }] } }] }
    }))));
    const requests = [
      askFastAI('What is photosynthesis?', { timeoutMs: 5000 }),
      askFastAI('Explain photosynthesis.', { timeoutMs: 5000 }),
      askFastAI('How do plants make food?', { timeoutMs: 5000 })
    ];
    await expect(askFastAI('Define photosynthesis.', { timeoutMs: 5000 }))
      .rejects.toMatchObject({ code: 'AI_CAPACITY' });
    expect(axios.post).toHaveBeenCalledTimes(3);
    pending.forEach(resolve => resolve());
    await expect(Promise.all(requests)).resolves.toHaveLength(3);
  });

  it('does not call a second backup after the first backup succeeds', async () => {
    axios.post.mockRejectedValueOnce(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }));
    axios.get.mockResolvedValueOnce({ data: { data: { response: 'Photosynthesis allows green plants to convert light energy, water and carbon dioxide into glucose and oxygen.' } } });

    await askFastAI('Explain photosynthesis.', { timeoutMs: 5000 });

    expect(axios.get).toHaveBeenCalledTimes(1);
  });
});


  it('uses a compact contextual prompt for legacy GET failover providers', () => {
    const prompt = buildFallbackPrompt('Why did that happen?', [
      { name: 'User', text: 'I was asking about the project.' },
      { name: 'Forge Bot', text: 'We were discussing the deployment.' }
    ], 'Relevant project context', 'english');
    expect(prompt).toContain('RECENT CONVERSATION');
    expect(prompt).toContain('Relevant project context');
    expect(prompt).toContain('CURRENT MESSAGE');
    expect(prompt.length).toBeLessThanOrEqual(2600);
  });


describe('creator command interpretation against the live registry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-gemini-key';
  });

  it('only returns a command that exists in the supplied registry', async () => {
    axios.post.mockResolvedValueOnce({
      data: { candidates: [{ content: { parts: [{ text: JSON.stringify({
        command: 'grouplock', args: ['quicklock', 'now', '60m'],
        confidence: 0.97, clarification: '', scope: 'current-chat'
      }) }] } }] }
    });
    const result = await interpretCreatorCommand('lock the group for an hour', [{
      command: 'grouplock', aliases: [], description: 'Lock or unlock the group',
      usage: '.grouplock lock|unlock', groupOnly: true
    }]);
    expect(result).toMatchObject({
      command: 'grouplock', args: ['quicklock', 'now', '60m'], confidence: 0.97
    });
    expect(axios.post.mock.calls[0][1].generationConfig.responseMimeType).toBe('application/json');
    expect(axios.post.mock.calls[0][2].timeout).toBe(5000);
    expect(axios.post.mock.calls[0][1].contents[0].parts[0].text).toContain('ongoing ordinary conversation');
    expect(axios.post.mock.calls[0][1].contents[0].parts[0].text).toContain('adminOnly');
  });

  it('returns a clarification instead of silently dropping an ambiguous creator instruction', async () => {
    axios.post.mockResolvedValueOnce({
      data: { candidates: [{ content: { parts: [{ text: JSON.stringify({
        command: '', args: [], confidence: 0.2,
        clarification: 'Which game should I start?', scope: 'current-chat'
      }) }] } }] }
    });
    await expect(interpretCreatorCommand('start the game', [{
      command: 'trivia', aliases: [], description: 'Start trivia',
      usage: '.trivia', groupOnly: true
    }])).resolves.toMatchObject({
      action: 'clarify',
      clarification: 'Which game should I start?'
    });
  });

  it('rejects invented commands and low-confidence interpretations', async () => {
    axios.post.mockResolvedValueOnce({
      data: { candidates: [{ content: { parts: [{ text: JSON.stringify({
        command: 'invented-command', args: [], confidence: 0.99
      }) }] } }] }
    });
    await expect(interpretCreatorCommand('do something unsupported', [{
      command: 'grouplock', aliases: [], description: 'Group lock'
    }])).resolves.toBeNull();

    axios.post.mockResolvedValueOnce({
      data: { candidates: [{ content: { parts: [{ text: JSON.stringify({
        command: 'grouplock', args: [], confidence: 0.4
      }) }] } }] }
    });
    await expect(interpretCreatorCommand('maybe lock it', [{
      command: 'grouplock', aliases: [], description: 'Group lock'
    }])).resolves.toBeNull();
  });
});

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
    expect(prompt).toContain('Matured Minded Room is adult-oriented');
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
