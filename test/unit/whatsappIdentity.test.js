import { describe, expect, it, vi } from 'vitest';
import { getWhatsAppIdentity, canonicalWhatsAppUserId, sameWhatsAppUser } from '../../lib/whatsappIdentity.js';

describe('WhatsApp PN/LID identity resolution', () => {
  it('maps an incoming LID to its canonical PN and retains the LID alias', async () => {
    const sock = { signalRepository: { lidMapping: { getPNForLID: vi.fn(async () => '2348012345678:4@s.whatsapp.net') } } };
    const result = await getWhatsAppIdentity(sock, '9988776655:2@lid');
    expect(result.canonical).toBe('2348012345678@s.whatsapp.net');
    expect(result.aliases).toContain('9988776655@lid');
  });
  it('recognises PN and LID forms as the same user', async () => {
    const sock = { signalRepository: { lidMapping: {
      getPNForLID: vi.fn(async () => '2348012345678@s.whatsapp.net'),
      getLIDForPN: vi.fn(async () => '9988776655@lid')
    } } };
    expect(await sameWhatsAppUser(sock, '9988776655@lid', '2348012345678@s.whatsapp.net')).toBe(true);
  });
  it('does not invent a PN mapping for an unresolved LID', async () => {
    const result = await getWhatsAppIdentity({}, '9988776655:1@lid');
    expect(result.canonical).toBe('9988776655@lid');
    expect(result.aliases).not.toContain('9988776655@s.whatsapp.net');
  });
  it('strips device suffixes without losing the JID namespace', async () => {
    expect(await canonicalWhatsAppUserId({}, '2348012345678:12@s.whatsapp.net')).toBe('2348012345678@s.whatsapp.net');
  });
});
