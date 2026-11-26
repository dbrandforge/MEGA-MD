export function groupAllMessage(text, extra = {}) {
  const body = String(text || '').replace(/^\s*@all\s*/i, '');
  return { ...extra, text: `@all ${body}`, mentionAll: true };
}

export async function sendGroupAll(sock, chatId, text, extra = {}, options) {
  if (!chatId?.endsWith('@g.us')) {
    return sock.sendMessage(chatId, { ...extra, text: String(text || '') }, options);
  }
  return sock.sendMessage(chatId, groupAllMessage(text, extra), options);
}
