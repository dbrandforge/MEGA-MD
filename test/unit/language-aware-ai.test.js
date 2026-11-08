import { describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { askFastAI, isUsefulAutomaticAnswer } from '../../lib/aiService.js';

vi.mock('axios', () => ({ default: { post: vi.fn(), get: vi.fn() } }));

const response = text => ({ data: { candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] } });

describe('language-aware Gemini response contract', () => {
  it.each([
    ['english', 'Reply entirely in clear, natural English'],
    ['pidgin', 'natural Nigerian Pidgin throughout'],
    ['yoruba', 'natural, correct Yoruba throughout']
  ])('sends the %s language instruction to Gemini', async (language, instruction) => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    axios.post.mockResolvedValue(response('This concept is explained clearly with enough detail to be meaningful.'));
    await askFastAI('Explain this concept', { language });
    const prompt = axios.post.mock.calls.at(-1)[1].contents[0].parts[0].text;
    expect(prompt).toContain(instruction);
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('requires the named person in a direct identity answer', () => {
    expect(isUsefulAutomaticAnswer('Who is Davido?', 'He is a Nigerian singer and songwriter.')).toBe(false);
    expect(isUsefulAutomaticAnswer('Who is Davido?', 'Davido is a Nigerian singer and songwriter.')).toBe(true);
  });

  it('does not discard a relevant academic explanation for low keyword overlap', () => {
    expect(isUsefulAutomaticAnswer(
      'Interpret this assertion relating to criminology: Man is born free, and everywhere he is in chains',
      'Rousseau argues that people begin with natural liberty, while social institutions and political authority can restrict that freedom. In criminology, this idea invites us to examine how laws, inequality, social expectations and state power shape behaviour. It does not mean every law is oppressive or that people should live without rules. Rather, it raises questions about legitimate authority, social control, justice and the conditions under which people accept or resist the rules governing society.'
    )).toBe(true);
  });

  it('allows short social greetings to receive personality-led replies', () => {
    expect(isUsefulAutomaticAnswer('How far?', 'I dey fine. You nko?')).toBe(true);
    expect(isUsefulAutomaticAnswer('How are you?', "I'm good, thanks for asking.")).toBe(true);
  });

  it('still rejects obvious conversational filler instead of treating it as an answer', () => {
    expect(isUsefulAutomaticAnswer('What is anomie?', 'Wetin bring you here?')).toBe(false);
  });
});
