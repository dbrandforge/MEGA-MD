import { describe, expect, it } from 'vitest';
import { classifyIntent, ensureResponseEmoji, getResponseLibraryStats, pickFallbackReply, pickLibraryReply, responseLibrary } from '../../data/chatbotResponseLibrary.js';

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

  it('includes concise knowledge presets for definitions, slang and activity questions', () => {
    for (const category of ['definition', 'slangDefinition', 'activityInfo']) expect(responseLibrary[category].length).toBeGreaterThan(0);
  });

  it('routes representative messages to specific intents', () => {
    expect(classifyIntent('I need advice about my career')).toBe('advice');
    expect(classifyIntent('My friend betrayed my trust')).toBe('friendship');
    expect(classifyIntent('Would you rather live by the sea?')).toBe('hypotheticals');
    expect(classifyIntent('That film had a brilliant ending')).toBe('entertainment');
    expect(classifyIntent('I feel overwhelmed today')).toBe('empathy');
  });

  it('recognises direct definitions, slang and activity questions', () => {
    expect(classifyIntent('What is love?')).toBe('definition');
    expect(classifyIntent("What's the meaning of fra?")).toBe('slangDefinition');
    expect(classifyIntent("What's the activity for today?")).toBe('activityInfo');
  });

  it('uses a matching preset first and sends unknown intents to the AI layer', () => {
    expect(pickLibraryReply('What is love?')).toMatch(/Love is/);
    expect(pickLibraryReply("What's the meaning of fra?")).toMatch(/fra/i);
    expect(pickLibraryReply('What is quantum mechanics?')).toBeNull();
    expect(pickLibraryReply('What does rizz mean?')).toBeNull();
    expect(pickLibraryReply("What's the group's activity for today?")).toMatch(/schedule|activity/i);
    expect(pickLibraryReply('Can you analyse this unusual situation?')).toBeNull();
  });

  it('adds a fitting emoji to preset and AI responses when missing', () => {
    expect(ensureResponseEmoji('Good morning', 'Good morning')).toMatch(/\p{Extended_Pictographic}/u);
    expect(ensureResponseEmoji('That is helpful 😂', 'thanks')).toBe('That is helpful 😂');
    expect(pickFallbackReply()).toMatch(/\p{Extended_Pictographic}/u);
  });

  it('avoids repeating the immediately previous preset when alternatives exist', () => {
    const previous = responseLibrary.greeting[0];
    expect(pickLibraryReply('Hello', previous)).not.toBe(previous);
  });
});
