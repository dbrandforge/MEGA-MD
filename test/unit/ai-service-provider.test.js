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
      .mockResolvedValueOnce({ data: { data: { response: 'The current official source confirms the answer.' } } });

    const answer = await askFastAI('Who is the current president of Nigeria?', {
      timeoutMs: 4000,
      history: [{ name: 'Forge', text: 'Please use facts.' }],
      liveContext: 'LIVE WEB SEARCH EVIDENCE: official source excerpt'
    });

    expect(answer).toContain('current official source');
    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(decodeURIComponent(axios.get.mock.calls[0][0])).toContain('LIVE WEB SEARCH EVIDENCE');
    expect(decodeURIComponent(axios.get.mock.calls[1][0])).toContain('official source excerpt');
  });

  it('accepts a provider response using the alternate answer field', async () => {
    axios.get.mockResolvedValueOnce({ data: { answer: 'A useful answer.' } });
    await expect(askFastAI('Explain a simple concept')).resolves.toBe('A useful answer.');
  });
});
