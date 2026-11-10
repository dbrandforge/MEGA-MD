import { describe, expect, it } from 'vitest';
import { hasActiveGroupFollowup, isExplicitlyAddressedInGroup, isBotNameTrigger, jidMatchesAnyBotIdentity, stripBotNameTrigger } from '../../lib/chatbotAccess.js';

describe('Forge Guard group chatbot follow-up access', () => {
  const now = 1_800_000_000_000;
  const recentHistory = [
    { name: 'Member', text: 'What is branding?', at: now - 60_000 },
    { name: 'Forge Bot', text: 'Branding is...', at: now - 30_000 }
  ];

  it('recognizes a leading bot or BOTA vocative without matching ordinary prose', () => {
    expect(isBotNameTrigger('BOTA')).toBe(true);
    expect(isBotNameTrigger('bot, explain this')).toBe(true);
    expect(isBotNameTrigger('I like this bot')).toBe(false);
  });

  it('removes the bot vocative before passing the question to Gemini', () => {
    expect(stripBotNameTrigger('BOTA what is photosynthesis?')).toBe('what is photosynthesis?');
    expect(stripBotNameTrigger('BOT, how far?')).toBe('how far?');
    expect(stripBotNameTrigger('BOTA')).toBe('hello');
    expect(stripBotNameTrigger('What is branding?')).toBe('What is branding?');
  });

  it('matches bot reply and mention identities across PN/LID aliases', async () => {
    const sock = {
      signalRepository: {
        lidMapping: {
          getPNForLID: async jid => jid === '90001@lid' ? '2348101268386@s.whatsapp.net' : undefined,
          getLIDForPN: async jid => jid === '2348101268386@s.whatsapp.net' ? '90001@lid' : undefined
        }
      }
    };
    expect(await jidMatchesAnyBotIdentity('90001@lid', ['2348101268386@s.whatsapp.net'], sock)).toBe(true);
    expect(await jidMatchesAnyBotIdentity('2348101268386@s.whatsapp.net', ['90001@lid'], sock)).toBe(true);
    expect(await jidMatchesAnyBotIdentity('90002@lid', ['2348101268386@s.whatsapp.net'], sock)).toBe(false);
  });

  it('requires an explicit mention or reply to start a group conversation', () => {
    expect(isExplicitlyAddressedInGroup({ isMention: true })).toBe(true);
    expect(isExplicitlyAddressedInGroup({ isReplyToBot: true })).toBe(true);
    expect(isExplicitlyAddressedInGroup({})).toBe(false);
  });

  it('allows the same participant to follow up while their own bot reply is recent', () => {
    expect(hasActiveGroupFollowup(recentHistory, now, 10 * 60_000)).toBe(true);
  });

  it('expires follow-up access after ten minutes', () => {
    const oldHistory = [{ name: 'Forge Bot', text: 'Earlier answer', at: now - 10 * 60_000 - 1 }];
    expect(hasActiveGroupFollowup(oldHistory, now, 10 * 60_000)).toBe(false);
  });

  it('does not activate without a previous bot reply', () => {
    expect(hasActiveGroupFollowup([{ name: 'Member', text: 'Hello', at: now }], now)).toBe(false);
  });

  it('does not activate for malformed, future-dated, or missing timestamps', () => {
    expect(hasActiveGroupFollowup(null, now)).toBe(false);
    expect(hasActiveGroupFollowup([{ name: 'Forge Bot', text: 'Hi', at: now + 1 }], now)).toBe(false);
    expect(hasActiveGroupFollowup([{ name: 'Forge Bot', text: 'Hi' }], now)).toBe(false);
  });

  it('keeps follow-up eligibility dependent on the caller-provided individual transcript', () => {
    const anotherMembersHistory = [{ name: 'Member', text: 'Hello', at: now - 1000 }];
    expect(hasActiveGroupFollowup(anotherMembersHistory, now)).toBe(false);
  });
});
