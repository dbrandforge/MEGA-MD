import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('axios', () => ({
  default: { get: vi.fn() }
}));

import axios from 'axios';
import { askFastAI, isUsefulAutomaticAnswer } from '../../lib/aiService.js';

describe('Automatic AI provider resilience', () => {
  beforeEach(() => axios.get.mockReset());

  it('forwards live evidence and falls back to the secondary provider after a primary HTTP failure', async () => {
    axios.get
      .mockRejectedValueOnce(Object.assign(new Error('Bad Request'), { code: 'ERR_BAD_REQUEST' }))
      .mockResolvedValueOnce({ data: { data: { response: "Nigeria's current president is Bola Ahmed Tinubu, according to the official source." } } });

    const answer = await askFastAI('Who is the current president of Nigeria?', {
      timeoutMs: 4000,
      history: [{ name: 'Forge', text: 'Please use facts.' }],
      liveContext: 'LIVE WEB SEARCH EVIDENCE: official source excerpt'
    });

    expect(answer).toContain('Nigeria\'s current president');
    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(decodeURIComponent(axios.get.mock.calls[0][0])).toContain('LIVE WEB SEARCH EVIDENCE');
    expect(decodeURIComponent(axios.get.mock.calls[1][0])).toContain('official source excerpt');
  });

  it('accepts a provider response using the alternate answer field', async () => {
    axios.get.mockResolvedValueOnce({ data: { answer: 'A concept is a basic idea that helps explain something.' } });
    await expect(askFastAI('Explain a simple concept')).resolves.toBe('A concept is a basic idea that helps explain something.');
  });
});


describe('Automatic AI answer quality gate', () => {
  beforeEach(() => axios.get.mockReset());
  it('rejects personality banter returned for a factual question and tries the next provider', async () => {
    axios.get
      .mockResolvedValueOnce({ data: { response: "Abi, what's good?" } })
      .mockResolvedValueOnce({ data: { response: 'Davido is a Nigerian singer, songwriter and record producer.' } });
    await expect(askFastAI('Who is Davido?')).resolves.toContain('Nigerian singer');
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  it('rejects a short unrelated answer instead of treating it as a successful answer', async () => {
    axios.get
      .mockResolvedValueOnce({ data: { response: 'Wetin bring you here today?' } })
      .mockResolvedValueOnce({ data: { response: "I'm listening." } });
    await expect(askFastAI('Who is the best football player?')).rejects.toThrow('Automatic AI providers failed');
  });

  it('accepts a concise answer that directly names the subject', async () => {
    axios.get.mockResolvedValueOnce({ data: { response: 'Davido is a Nigerian singer.' } });
    await expect(askFastAI('Who is Davido?')).resolves.toContain('Nigerian singer');
  });
});

describe('Subject relevance validation', () => {
  it('rejects a fluent but unrelated response to a song question', () => {
    expect(isUsefulAutomaticAnswer(
      "Tell me about Davido's song Aye",
      'A good character can save an average plot. Who gave the strongest performance?'
    )).toBe(false);
  });

  it('accepts a substantive answer that names the requested subject', () => {
    expect(isUsefulAutomaticAnswer(
      "Tell me about Davido's song Aye",
      'Aye is a song by Davido that explores romantic affection and commitment.'
    )).toBe(true);
  });
});


describe('General-purpose relevance guard', () => {
  it('rejects answers that share one incidental word but miss the requested subject', () => {
    expect(isUsefulAutomaticAnswer(
      'Explain operating leverage in business',
      'A quick loan can help a business cover urgent expenses when cash flow is tight.'
    )).toBe(false);
  });

  it('accepts answers that address the key subject of a multi-part question', () => {
    expect(isUsefulAutomaticAnswer(
      'Explain operating leverage in business',
      'Operating leverage describes how fixed operating costs affect a business\'s operating profit as sales change.'
    )).toBe(true);
  });

  it('accepts a substantive semantic answer that does not repeat the question keywords', () => {
    expect(isUsefulAutomaticAnswer(
      'What is the botanical name of rice?',
      'Rice is scientifically known as Oryza sativa. It is a domesticated cereal grass cultivated worldwide, with several varieties used in food production. The plant belongs to the grass family Poaceae and is one of the most important staple crops for human nutrition.'
    )).toBe(true);
    expect(isUsefulAutomaticAnswer(
      'How do I prepare Nigerian smoky jollof rice?',
      'Start by blending tomatoes, red bell peppers, Scotch bonnet and onion. Fry the mixture in seasoned oil, add stock and washed long-grain rice, then cook covered until tender. Allow the bottom layer to toast gently near the end to develop the characteristic smoky aroma without burning the rice.'
    )).toBe(true);
  });

  it('continues to accept concise answers to single-subject questions', () => {
    expect(isUsefulAutomaticAnswer(
      'What is photosynthesis?',
      'Photosynthesis is the process plants use to convert light energy into chemical energy.'
    )).toBe(true);
  });

  it('accepts named-entity answers to person and ranking questions without literal subject overlap', () => {
    expect(isUsefulAutomaticAnswer(
      'Who is the GOAT in football?',
      'Lionel Messi is widely regarded as one of football\'s greatest players.'
    )).toBe(true);
    expect(isUsefulAutomaticAnswer(
      'Who is the best music Afro pop artist?',
      'Wizkid is one of Afropop\'s most influential artists.'
    )).toBe(true);
  });

  it('accepts a named answer when it is grounded in retrieved live evidence', () => {
    expect(isUsefulAutomaticAnswer(
      "What's the name of the first lady of Nigeria",
      'Senator Oluremi Tinubu is the First Lady of Nigeria.',
      'LIVE WEB SEARCH EVIDENCE: State House leadership page lists Sen. Oluremi Tinubu as First Lady, Federal Republic of Nigeria.'
    )).toBe(true);
  });
});
