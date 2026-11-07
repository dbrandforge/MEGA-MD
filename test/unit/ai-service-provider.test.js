import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('axios', () => ({
  default: { get: vi.fn() }
}));

import axios from 'axios';
import { askFastAI } from '../../lib/aiService.js';

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
