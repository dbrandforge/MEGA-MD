export const GROUP_USER_DATA_MAPS = [
  'welcome',
  'goodbye',
  'chatbot',
  'antilink',
  'antibadword',
  'antitag'
];

export const GROUP_SETTING_KEYS = [
  'anonymousState',
  'antilink',
  'manualGameLocks'
];

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function copyGroupUserData(sourceData = {}, sourceGroupId, targetGroupId) {
  const next = clone(sourceData) || {};
  for (const key of GROUP_USER_DATA_MAPS) {
    if (!next[key] || typeof next[key] !== 'object') next[key] = {};
    if (Object.prototype.hasOwnProperty.call(sourceData?.[key] || {}, sourceGroupId)) {
      next[key][targetGroupId] = clone(sourceData[key][sourceGroupId]);
    } else {
      delete next[key][targetGroupId];
    }
  }
  return next;
}

export function copyGroupSettings(sourceSettings = {}) {
  const next = {};
  for (const key of GROUP_SETTING_KEYS) {
    if (Object.prototype.hasOwnProperty.call(sourceSettings, key)) {
      next[key] = clone(sourceSettings[key]);
    }
  }
  if (!Object.prototype.hasOwnProperty.call(next, 'anonymousState')) next.anonymousState = { enabled: false };
  if (!Object.prototype.hasOwnProperty.call(next, 'antilink')) next.antilink = { enabled: false, action: 'delete' };
  if (!Object.prototype.hasOwnProperty.call(next, 'manualGameLocks')) next.manualGameLocks = {};
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
