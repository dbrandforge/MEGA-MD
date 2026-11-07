import { describe, expect, it } from 'vitest';
import { getDMChatbotPermission, migrateDMChatbotDefault } from '../../lib/dmAccess.js';
import { getAnticallOverride, shouldBlockCaller } from '../../lib/anticallAccess.js';

describe('DM chatbot access controls', () => {
  it('migrates the old universal-on default to off once', () => {
    const data = { chatbotDMEnabled: true, chatbotDM: { 'user@lid': true } };
    expect(migrateDMChatbotDefault(data)).toBe(true);
    expect(data.chatbotDMEnabled).toBe(false);
    expect(data.chatbotDM['user@lid']).toBe(true);
    expect(migrateDMChatbotDefault(data)).toBe(false);
  });

  it('defaults new people to off unless the universal switch is enabled', () => {
    expect(getDMChatbotPermission({ chatbotDMEnabled: false }, '2348000000000@s.whatsapp.net', '2348000000000@s.whatsapp.net')).toBe(false);
    expect(getDMChatbotPermission({ chatbotDMEnabled: true }, '2348000000000@s.whatsapp.net', '2348000000000@s.whatsapp.net')).toBe(true);
  });

  it('uses individual opt-ins and opt-outs ahead of the universal switch', () => {
    expect(getDMChatbotPermission({ chatbotDMEnabled: false, chatbotDM: { '2348000000000@s.whatsapp.net': true } }, '2348000000000@s.whatsapp.net', '2348000000000@s.whatsapp.net')).toBe(true);
    expect(getDMChatbotPermission({ chatbotDMEnabled: true, chatbotDM: { '2348000000000@s.whatsapp.net': false } }, '2348000000000@s.whatsapp.net', '2348000000000@s.whatsapp.net')).toBe(false);
  });

  it('honours legacy LID overrides while prioritizing a newer resolved phone override', () => {
    const data = { chatbotDMEnabled: false, chatbotDM: { '123456789@lid': true, '2348000000000@s.whatsapp.net': false } };
    expect(getDMChatbotPermission(data, '2348000000000@s.whatsapp.net', '123456789@lid')).toBe(false);
    expect(getDMChatbotPermission({ chatbotDM: { '123456789@lid': true } }, '2348000000000@s.whatsapp.net', '123456789@lid')).toBe(true);
  });

  it('keeps recognized identities available when no explicit override exists', () => {
    expect(getDMChatbotPermission({ chatbotDMEnabled: false }, '2348000000000@s.whatsapp.net', '2348000000000@s.whatsapp.net', { role: 'creator' })).toBe(true);
  });
});

describe('AntiCall universal and individual controls', () => {
  it('uses the universal setting unless an individual override exists', () => {
    expect(shouldBlockCaller({ enabled: true }, '2348000000000@s.whatsapp.net')).toBe(true);
    expect(shouldBlockCaller({ enabled: false }, '2348000000000@s.whatsapp.net')).toBe(false);
  });

  it('allows a personal opt-out to override universal blocking', () => {
    const state = { enabled: true, users: { '2348000000000': false } };
    expect(getAnticallOverride(state, '2348000000000@s.whatsapp.net')).toBe(false);
    expect(shouldBlockCaller(state, '2348000000000@s.whatsapp.net')).toBe(false);
  });

  it('allows a personal opt-in to override the universal off switch', () => {
    expect(shouldBlockCaller({ enabled: false, users: { '2348000000000': true } }, '2348000000000@s.whatsapp.net')).toBe(true);
  });
});
