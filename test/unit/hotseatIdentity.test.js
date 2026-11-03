import { describe, expect, it, vi } from 'vitest';
import { resolveHotSeatPlayerKey } from '../../plugins/hotseat.js';

describe('Hot Seat participant identity normalization', () => {
    it('matches a PN-resolved sender to a legacy LID session participant', async () => {
        const lid = '123456789@lid';
        const pn = '2348000000000@s.whatsapp.net';
        const sock = {
            signalRepository: {
                lidMapping: {
                    getPNForLID: vi.fn(async () => pn)
                }
            }
        };
        const session = {
            players: [lid],
            playerStates: { [lid]: { status: 'active', waiting: true } }
        };

        await expect(resolveHotSeatPlayerKey(sock, session, pn)).resolves.toBe(lid);
    });

    it('matches device-qualified PN messages to plain PN session keys', async () => {
        const pn = '2348000000000@s.whatsapp.net';
        const session = {
            players: [pn],
            playerStates: { [pn]: { status: 'active', waiting: true } }
        };

        await expect(resolveHotSeatPlayerKey({}, session, '2348000000000:12@s.whatsapp.net')).resolves.toBe(pn);
    });
});
