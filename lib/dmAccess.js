function cleanPhone(value) {
  const raw = String(value || '');
  if (raw.includes('@lid')) return '';
  return raw.split('@')[0].split(':')[0].replace(/\D/g, '');
}

export function getDMChatbotPermission(data = {}, senderId, chatId, identity = null) {
  const overrides = data.chatbotDM && typeof data.chatbotDM === 'object' ? data.chatbotDM : {};
  const candidates = [senderId, chatId].filter(Boolean);
  // Prefer the resolved phone JID, then the original chat JID, before number matching.
  for (const candidate of candidates) {
    if (typeof overrides[candidate] === 'boolean') return overrides[candidate];
  }
  for (const [jid, enabled] of Object.entries(overrides)) {
    if (typeof enabled !== 'boolean') continue;
    const storedNumber = cleanPhone(jid);
    if (storedNumber && candidates.some(candidate => cleanPhone(candidate) === storedNumber)) return enabled;
  }
  return data.chatbotDMEnabled === true || Boolean(identity);
}

export function migrateDMChatbotDefault(data = {}) {
  if (data.chatbotDMDefaultMigrated === true) return false;
  if (data.chatbotDMEnabled === true) data.chatbotDMEnabled = false;
  data.chatbotDMDefaultMigrated = true;
  if (!data.chatbotDM || typeof data.chatbotDM !== 'object') data.chatbotDM = {};
  return true;
}
