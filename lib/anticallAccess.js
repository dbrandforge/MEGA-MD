function cleanPhone(value) {
  return String(value || '').split('@')[0].split(':')[0].replace(/\D/g, '');
}

export function getAnticallOverride(state = {}, caller) {
  const users = state.users && typeof state.users === 'object' ? state.users : {};
  const number = cleanPhone(caller);
  if (!number) return undefined;
  if (typeof users[number] === 'boolean') return users[number];
  for (const [key, enabled] of Object.entries(users)) {
    if (typeof enabled !== 'boolean') continue;
    if (key === caller || cleanPhone(key) === number) return enabled;
  }
  return undefined;
}

export function shouldBlockCaller(state = {}, caller) {
  const personal = getAnticallOverride(state, caller);
  return typeof personal === 'boolean' ? personal : state.enabled === true;
}
