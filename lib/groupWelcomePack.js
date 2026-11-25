import { welcomeMessage, groupRules } from '../data/welcomeData.js';

export const WELCOME_PACK_SETTING = 'welcomePackConfig';
const defaultRulesAndActivity = `${groupRules}\n\n📅 *TODAY'S ACTIVITY*\n\n{daily_activity}`;
export const DEFAULT_WELCOME_PACK_MESSAGES = [welcomeMessage, defaultRulesAndActivity];

export function normalizeWelcomePackConfig(saved = {}) {
  if (!saved || typeof saved !== 'object') saved = {};
  const messages = Array.isArray(saved.messages) ? saved.messages : [];
  let first = typeof messages[0] === 'string' && messages[0].trim()
    ? messages[0]
    : DEFAULT_WELCOME_PACK_MESSAGES[0];
  if (!first.includes('@user') && !first.includes('{user}')) {
    first = `${first}\n\n@user`;
  }

  // Migrate legacy three-slot settings into one rules/activity message.
  let second = typeof messages[1] === 'string' && messages[1].trim()
    ? messages[1]
    : groupRules;
  const legacyActivity = typeof messages[2] === 'string' && messages[2].trim()
    ? messages[2]
    : "📅 *TODAY'S ACTIVITY*\n\n{daily_activity}";
  if (!second.toLowerCase().includes('{daily_activity}')) {
    second = `${second}\n\n${legacyActivity}`;
  }
  if (!second.includes('@user') && !second.includes('{user}')) {
    second = `${second}\n\n@user`;
  }

  return { enabled: saved.enabled !== false, messages: [first, second] };
}

export function renderWelcomePackMessage(template, dailyActivity = '') {
  const fallbackActivity = dailyActivity || "Today's activity will be announced shortly.";
  return String(template || '').replace(/\{daily_activity\}/gi, fallbackActivity);
}
