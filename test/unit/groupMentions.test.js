import { describe, expect, it, vi } from 'vitest';
import { groupAllMessage, sendGroupAll } from '../../lib/groupMentions.js';

describe('native WhatsApp group-wide mentions', () => {
  it('uses one native @all marker without constructing individual member mentions', () => {
    expect(groupAllMessage('Group unlocked')).toEqual({ text: '@all Group unlocked', mentionAll: true });
  });

  it('preserves additional message metadata while enabling native @all', () => {
    expect(groupAllMessage('Trivia is open', { mentions: ['234800000000@s.whatsapp.net'] })).toEqual({
      text: '@all Trivia is open',
      mentionAll: true,
      mentions: ['234800000000@s.whatsapp.net']
    });
  });

  it('uses the native group mention field when sending a group announcement', async () => {
    const sock = { sendMessage: vi.fn(async () => ({ key: { id: 'native-all' } })) };
    const chatId = '120363000000000000@g.us';
    await sendGroupAll(sock, chatId, 'Group activity');
    expect(sock.sendMessage).toHaveBeenCalledWith(chatId, { text: '@all Group activity', mentionAll: true }, undefined);
  });
});