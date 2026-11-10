import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WELCOME_PACK_MESSAGES,
  normalizeWelcomePackConfig,
  renderWelcomePackMessage
} from '../../lib/groupWelcomePack.js';

describe('per-group three-message welcome pack settings', () => {
  it('defaults to enabled and preserves the three standard messages', () => {
    const config = normalizeWelcomePackConfig(null);
    expect(config.enabled).toBe(true);
    expect(config.messages).toEqual(DEFAULT_WELCOME_PACK_MESSAGES);
  });

  it('can disable the pack without discarding its message templates', () => {
    const saved = { enabled: false, messages: ['Custom one', 'Custom two', 'Custom three'] };
    const config = normalizeWelcomePackConfig(saved);
    expect(config.enabled).toBe(false);
    expect(config.messages).toEqual(saved.messages);
  });

  it('falls back per slot when a message is missing, without overwriting other slots', () => {
    const config = normalizeWelcomePackConfig({ enabled: true, messages: ['Custom welcome'] });
    expect(config.messages[0]).toBe('Custom welcome');
    expect(config.messages[1]).toBe(DEFAULT_WELCOME_PACK_MESSAGES[1]);
    expect(config.messages[2]).toBe(DEFAULT_WELCOME_PACK_MESSAGES[2]);
  });

  it('renders the daily activity placeholder and has a safe fallback', () => {
    expect(renderWelcomePackMessage('Today: {daily_activity}', 'Football night')).toBe('Today: Football night');
    expect(renderWelcomePackMessage('Today: {daily_activity}', '')).toContain('announced shortly');
  });
});
