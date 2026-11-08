import { describe, expect, it } from 'vitest';
import { getLagosClockReply } from '../../plugins/chatbot.js';

describe('Lagos clock answers', () => {
  it('answers date and time together using Africa/Lagos timezone', () => {
    const result = getLagosClockReply("What is today's date and current time?", new Date('2026-11-08T09:55:00.000Z'));
    expect(result).toContain('Sunday, 8 November 2026');
    expect(result).toContain('10:55 am WAT (UTC+1)');
  });
  it('answers a Lagos time query without requiring web search', () => {
    const result = getLagosClockReply('What is the current time in Lagos Nigeria?', new Date('2026-11-08T09:55:00.000Z'));
    expect(result).toContain('10:55 am WAT (UTC+1)');
  });
  it('does not intercept unrelated current-information questions', () => {
    expect(getLagosClockReply('Who is the president of Nigeria?')).toBeNull();
  });
});
