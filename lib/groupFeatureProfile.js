export const MATURED_MIND_EXCLUSIVE_MAPS = ['welcome', 'goodbye'];
export const GENERAL_GROUP_MAPS = ['chatbot', 'antilink', 'antibadword', 'antitag'];
export const GROUP_USER_DATA_MAPS = [...MATURED_MIND_EXCLUSIVE_MAPS, ...GENERAL_GROUP_MAPS];

export const MATURED_MIND_EXCLUSIVE_SETTINGS = [];
export const GENERAL_GROUP_SETTINGS = ['anonymousState', 'antilink', 'manualGameLocks'];
export const GROUP_SETTING_KEYS = [...MATURED_MIND_EXCLUSIVE_SETTINGS, ...GENERAL_GROUP_SETTINGS];

export const MATURED_MIND_EXCLUSIVE_FEATURES = [
  'Three-message welcome pack and group rules',
  'New-member introduction tracking and reminders',
  'Member departure and return messages',
  'Daily activity announcements',
  'Matured Minded group lifecycle and daily lock/unlock schedule'
];

export const GENERAL_GROUP_FEATURES = [
  'Group chatbot',
  'Anti-link, anti-badword and anti-tag controls',
  'Anti-spam protection',
  'Anonymous Night',
  'All general group games and game-lock controls',
  'General group moderation and utility commands'
];

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function copyGroupUserData(sourceData = {}, sourceGroupId, targetGroupId, maps = GROUP_USER_DATA_MAPS) {
  const next = clone(sourceData) || {};
  for (const key of maps) {
    if (!next[key] || typeof next[key] !== 'object') next[key] = {};
    if (Object.prototype.hasOwnProperty.call(sourceData?.[key] || {}, sourceGroupId)) {
      next[key][targetGroupId] = clone(sourceData[key][sourceGroupId]);
    } else {
      delete next[key][targetGroupId];
    }
  }
  return next;
}

export function copyGroupSettings(sourceSettings = {}, keys = GROUP_SETTING_KEYS) {
  const next = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(sourceSettings, key)) {
      next[key] = clone(sourceSettings[key]);
    }
  }
  if (keys.includes('anonymousState') && !Object.prototype.hasOwnProperty.call(next, 'anonymousState')) {
    next.anonymousState = { enabled: false };
  }
  if (keys.includes('antilink') && !Object.prototype.hasOwnProperty.call(next, 'antilink')) {
    next.antilink = { enabled: false, action: 'delete' };
  }
  if (keys.includes('manualGameLocks') && !Object.prototype.hasOwnProperty.call(next, 'manualGameLocks')) {
    next.manualGameLocks = {};
  }
  return next;
}

export function copyAntispamGroupConfig(sourceAntispam = {}, sourceGroupId, targetGroupId) {
  const next = clone(sourceAntispam) || {};
  if (!next.groups || typeof next.groups !== 'object') next.groups = {};
  if (Object.prototype.hasOwnProperty.call(sourceAntispam?.groups || {}, sourceGroupId)) {
    next.groups[targetGroupId] = clone(sourceAntispam.groups[sourceGroupId]);
  } else {
    delete next.groups[targetGroupId];
  }
  return next;
}
