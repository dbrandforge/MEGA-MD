import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../plugins/gender.js', () => ({ getUserGender: vi.fn() }));
vi.mock('../../data/todLists.js', () => ({ getTruths: vi.fn(() => ['A truth']), randomFrom: vi.fn(items => items[0]) }));
vi.mock('../../plugins/daylock.js', () => ({ isGameAllowed: vi.fn() }));
vi.mock('../../plugins/truth-continue.js', () => ({
  startSoloSession: vi.fn(),
  setSoloQuestionMessage: vi.fn(),
  endSoloSession: vi.fn()
}));

import truth from '../../plugins/truth.js';
import { isGameAllowed } from '../../plugins/daylock.js';
import { endSoloSession } from '../../plugins/truth-continue.js';

describe('.truth session controls', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(['stop', 'end', 'cancel'])('ends the current session for .truth %s without starting another prompt', async action => {
    endSoloSession.mockResolvedValue(true);
    const sock = { sendMessage: vi.fn(async () => ({})) };
    const message = { key: { remoteJid: '120363000000000000@g.us' } };
    const context = { chatId: message.key.remoteJid, senderId: '234800000000@s.whatsapp.net', channelInfo: {} };

    await truth.handler(sock, message, [action], context);

    expect(endSoloSession).toHaveBeenCalledWith(context.chatId, context.senderId);
    expect(isGameAllowed).not.toHaveBeenCalled();
    expect(sock.sendMessage).toHaveBeenCalledTimes(1);
  });
});
