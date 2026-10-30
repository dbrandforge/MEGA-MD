import { describe, expect, it } from 'vitest';
import { classifyIntent, getResponseLibraryStats, responseLibrary } from '../../data/chatbotResponseLibrary.js';

describe('Forge Bot response library', () => {
  it('contains more than 2,000 curated fallback replies', () => {
    const replies = Object.values(responseLibrary).flat();
    expect(replies.length).toBeGreaterThan(2000);
    expect(new Set(replies.map(reply => reply.trim().toLowerCase())).size).toBe(replies.length);
    expect(getResponseLibraryStats().total).toBe(replies.length);
  });

  it('keeps the expanded conversational categories populated', () => {
    for (const category of ['relationships', 'friendship', 'boundaries', 'empathy', 'advice', 'workLife', 'debate', 'entertainment', 'nigerianCulture', 'storytelling', 'hypotheticals', 'humour', 'teasing', 'savage', 'group', 'boredom', 'pidgin', 'yoruba', 'fallback']) {
      expect(responseLibrary[category].length).toBeGreaterThanOrEqual(50);
    }
  });

  it('routes representative messages to specific intents', () => {
    expect(classifyIntent('I need advice about my career')).toBe('advice');
    expect(classifyIntent('My friend betrayed my trust')).toBe('friendship');
    expect(classifyIntent('Would you rather live by the sea?')).toBe('hypotheticals');
    expect(classifyIntent('That film had a brilliant ending')).toBe('entertainment');
    expect(classifyIntent('I feel overwhelmed today')).toBe('empathy');
  });
});
