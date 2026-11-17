function stripDevice(jid) { return String(jid || '').replace(/:\d+(?=@)/, ''); }
export function normalizeWhatsAppJid(jid) { const value = stripDevice(jid).trim(); if (!value) return ''; return value.includes('@') ? value : value + '@s.whatsapp.net'; }
export async function getWhatsAppIdentity(sock, jid) {
 const original = normalizeWhatsAppJid(jid); if (!original) return { canonical: '', aliases: [] };
 const aliases = new Set([original, stripDevice(jid)]); const mapping = sock?.signalRepository?.lidMapping; let canonical = original;
 try { if (original.endsWith('@lid')) { const pn = await mapping?.getPNForLID?.(original); if (typeof pn === 'string' && pn.endsWith('@s.whatsapp.net')) { canonical = normalizeWhatsAppJid(pn); aliases.add(canonical); } } else if (original.endsWith('@s.whatsapp.net')) { const lid = await mapping?.getLIDForPN?.(original); if (typeof lid === 'string' && lid.endsWith('@lid')) aliases.add(normalizeWhatsAppJid(lid)); } } catch {}
 aliases.add(canonical); for (const alias of [...aliases]) { const bare = alias.split('@')[0]; if (bare) aliases.add(bare); }
 if (canonical.endsWith('@s.whatsapp.net')) aliases.add(canonical.split('@')[0]); return { canonical, aliases: [...aliases] };
}
export async function canonicalWhatsAppUserId(sock, jid) { return (await getWhatsAppIdentity(sock, jid)).canonical; }
export async function sameWhatsAppUser(sock, left, right) { if (!left || !right) return false; const [a,b] = await Promise.all([getWhatsAppIdentity(sock,left),getWhatsAppIdentity(sock,right)]); return Boolean(a.canonical && b.canonical && (a.canonical === b.canonical || a.aliases.some(alias => b.aliases.includes(alias)))); }
