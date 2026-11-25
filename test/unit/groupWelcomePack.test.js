import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WELCOME_PACK_MESSAGES,
  normalizeWelcomePackConfig,
  renderWelcomePackMessage
} from '../../lib/groupWelcomePack.js';

describe('per-group two-message welcome pack settings', () => {
  it('defaults to two messages: introduction guidance, then rules and activity', () => {
    const config = normalizeWelcomePackConfig(null);
    expect(config.enabled).toBe(true);
    expect(config.messages).toHaveLength(2);
    expect(config.messages).toEqual(DEFAULT_WELCOME_PACK_MESSAGES);
    expect(config.messages[1]).toContain('{daily_activity}');
    expect(config.messages[0]).toContain('@user');
    expect(config.messages[1]).toContain('@user');
  });

  it('can disable the pack without discarding its two message templates', () => {
    const saved = { enabled: false, messages: ['Custom one', 'Custom two'] };
    const config = normalizeWelcomePackConfig(saved);
    expect(config.enabled).toBe(false);
    expect(config.messages[1]).toContain('Custom two');
    expect(config.messages[1]).toContain('{daily_activity}');
    expect(config.messages[1]).toContain('@user');
  });

  it('adds a visible mention placeholder to customised messages when missing', () => {
    const config = normalizeWelcomePackConfig({ messages: ['Custom intro', 'Custom rules'] });
    expect(config.messages[0]).toContain('@user');
    expect(config.messages[1]).toContain('@user');
  });

  it('migrates the previous three-message format into the second message', () => {
    const config = normalizeWelcomePackConfig({
      enabled: true,
      messages: ['Custom intro', 'Custom rules', 'Custom daily activity: {daily_activity}']
    });
    expect(config.messages).toHaveLength(2);
    expect(config.messages[0]).toBe('Custom intro');
    expect(config.messages[1]).toContain('Custom rules');
    expect(config.messages[1]).toContain('Custom daily activity: {daily_activity}');
    expect(config.messages[1]).toContain('@user');
  });

  it('does not append a second activity block when legacy rules already contain the placeholder', () => {
    const config = normalizeWelcomePackConfig({
      messages: ['Intro', 'Rules {daily_activity}', 'Old third message']
    });
    expect(config.messages[1].split('{daily_activity}').length - 1).toBe(1);
    expect(config.messages[1]).not.toContain('Old third message');
  });

  it('renders the daily activity placeholder and has a safe fallback', () => {
    expect(renderWelcomePackMessage('Today: {daily_activity}', 'Football night')).toBe('Today: Football night');
    expect(renderWelcomePackMessage('Today: {daily_activity}', '')).toContain('announced shortly');
  });
});
