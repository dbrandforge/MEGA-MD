export function normalizeVCardNumber(value, waid = '') {
  let digits = String(waid || value || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = '234' + digits.slice(1);
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

export function parseVCardContacts(input = '') {
  const source = String(input || '').replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '');
  const blocks = source.match(/BEGIN:VCARD[\s\S]*?END:VCARD/gi) || [];
  const contacts = new Map();
  for (const block of blocks) {
    const lines = block.split('\n');
    const nameLine = lines.find(line => /^FN(?:;[^:]*)?:/i.test(line));
    const name = nameLine ? nameLine.slice(nameLine.indexOf(':') + 1).trim() : '';
    for (const line of lines) {
      const match = line.match(/^(?:item\d+\.)?TEL([^:]*)\s*:(.*)$/i);
      if (!match) continue;
      const waid = match[1].match(/waid=(\d+)/i)?.[1] || '';
      const raw = match[2].replace(/^tel:/i, '').trim();
      const number = normalizeVCardNumber(raw, waid);
      if (!number || contacts.has(number)) continue;
      contacts.set(number, { name, number, jid: number + '@s.whatsapp.net' });
    }
  }
  return [...contacts.values()];
}
