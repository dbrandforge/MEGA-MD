import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => ({
    default: {
        post: vi.fn(),
        get: vi.fn()
    }
}));

import axios from 'axios';
import { askAI, askFastAI } from '../../lib/aiService.js';

const geminiResponse = (text) => ({
    data: {
        candidates: [{
            content: {
                role: 'model',
                parts: [{ text }]
            },
            finishReason: 'STOP'
        }]
    }
});

describe('Forge Guard Gemini provider', () => {
    beforeEach(() => {
        vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
        vi.stubEnv('GEMINI_MODEL', '');
        vi.resetAllMocks();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('sends automatic answers to the current Flash-Lite generateContent endpoint', async () => {
        axios.post.mockResolvedValue(geminiResponse('Wizkid is a Nigerian singer and songwriter known for Afrobeats.'));

        const answer = await askFastAI('Who is Wizkid?');

        expect(answer).toContain('Wizkid');
        expect(axios.post).toHaveBeenCalledTimes(1);
        const [url, body, config] = axios.post.mock.calls[0];
        expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
        expect(config.headers['x-goog-api-key']).toBe('test-gemini-key');
        expect(body.contents[0].parts[0].text).toContain('Who is Wizkid?');
    });

    it('passes recent conversation and live research evidence into Gemini', async () => {
        axios.post.mockResolvedValue(geminiResponse('Marketing is the process of understanding customers and creating value for them.'));

        await askFastAI('What is marketing?', {
            history: [{ name: 'User', text: 'I run a small business.' }],
            liveContext: 'LIVE WEB SEARCH EVIDENCE: verified source excerpt.'
        });

        const prompt = axios.post.mock.calls[0][1].contents[0].parts[0].text;
        expect(prompt).toContain('I run a small business.');
        expect(prompt).toContain('verified source excerpt');
    });

    it('keeps the standalone .gpt prompt contract separate while using Gemini', async () => {
        axios.post.mockResolvedValue(geminiResponse('Photosynthesis is how plants convert light energy into chemical energy.'));

        const answer = await askAI('Define photosynthesis');

        expect(answer).toContain('Photosynthesis');
        const prompt = axios.post.mock.calls[0][1].contents[0].parts[0].text;
        expect(prompt).toContain('Answer the actual question directly.');
        expect(prompt).not.toContain('conversational WhatsApp personality');
    });

    it('retries a fast transient Gemini server failure before returning a valid answer', async () => {
        const unavailable = new Error('temporarily unavailable');
        unavailable.response = { status: 503 };
        axios.post
            .mockRejectedValueOnce(unavailable)
            .mockResolvedValueOnce(geminiResponse('Davido is a Nigerian singer and songwriter.'));

        await expect(askFastAI('Who is Davido?')).resolves.toContain('Davido');
        expect(axios.post).toHaveBeenCalledTimes(2);
    });

    it('does not retry a timed-out Gemini request and therefore avoids a second full wait', async () => {
        const timeout = new Error('request timed out');
        timeout.code = 'ECONNABORTED';
        axios.post.mockRejectedValue(timeout);

        await expect(askFastAI('Who is Davido?')).rejects.toMatchObject({
            code: 'GEMINI_TIMEOUT'
        });
        expect(axios.post).toHaveBeenCalledTimes(1);
    });

    it('surfaces a clear provider error code instead of silently returning banter', async () => {
        const error = new Error('rate limited');
        error.response = { status: 429 };
        axios.post.mockRejectedValue(error);

        await expect(askFastAI('Who is Davido?')).rejects.toMatchObject({
            code: 'GEMINI_HTTP_429'
        });
    });

    it('rejects irrelevant banter returned by Gemini', async () => {
        axios.post.mockResolvedValue(geminiResponse('Wetin bring you here?'));

        await expect(askFastAI('Who is Davido?')).rejects.toMatchObject({
            code: 'GEMINI_NON_ANSWER'
        });
    });
});
