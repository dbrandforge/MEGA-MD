import { describe, expect, it } from 'vitest';
import { parseVCardContacts, normalizeVCardNumber } from '../../lib/vcardContacts.js';

describe('VCF contact parsing', () => {
  it('extracts international numbers and WhatsApp waid values', () => {
    const vcf = 'BEGIN:VCARD\nVERSION:3.0\nFN:Jane Doe\nitem1.TEL;TYPE=CELL;waid=2348012345678:+234 801 234 5678\nEND:VCARD';
    expect(parseVCardContacts(vcf)).toEqual([
      { name: 'Jane Doe', number: '2348012345678', jid: '2348012345678@s.whatsapp.net' }
    ]);
  });
  it('normalizes Nigerian local 11-digit mobile numbers', () => {
    expect(normalizeVCardNumber('08012345678')).toBe('2348012345678');
  });
  it('deduplicates repeated contacts and ignores invalid telephone fields', () => {
    const vcf = [
      'BEGIN:VCARD\nFN:One\nTEL;TYPE=CELL:+2348012345678\nEND:VCARD',
      'BEGIN:VCARD\nFN:Duplicate\nTEL;TYPE=CELL:+2348012345678\nEND:VCARD',
      'BEGIN:VCARD\nFN:Invalid\nTEL;TYPE=CELL:123\nEND:VCARD'
    ].join('\n');
    expect(parseVCardContacts(vcf)).toHaveLength(1);
    expect(parseVCardContacts(vcf)[0].name).toBe('One');
  });
});
