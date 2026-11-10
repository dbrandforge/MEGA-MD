import { welcomeMessage, groupRules } from '../data/welcomeData.js';

export const WELCOME_PACK_SETTING = 'welcomePackConfig';
export const DEFAULT_WELCOME_PACK_MESSAGES = [
  welcomeMessage,
  groupRules,
  "📅 *Today's activity*\n\n{daily_activity}"
];

export function normalizeWelcomePackConfig(saved = {}) {
  const messages = Array.isArray(saved.messages) ? saved.messages : [];
  return {
    enabled: saved.enabled !== false,
    messages: DEFAULT_WELCOME_PACK_MESSAGES.map((fallback, index) =>
      typeof messages[index] === 'string' && messages[index].trim()
        ? messages[index]
        : fallback
    )
  };
}

export function renderWelcomePackMessage(template, dailyActivity = '') {
  const fallbackActivity = dailyActivity || 'Today\'s activity will be announced shortly.';
  return String(template || '').replace(/\{daily_activity\}/gi, fallbackActivity);
}
