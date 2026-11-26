import { describe, expect, it, vi } from 'vitest';
import { filterParticipantsByGender } from '../../lib/genderTagging.js';

describe('gender-based group tagging', () => {
    it('includes only participants whose saved gender matches the requested group', async () => {
        const participants = [{ id: 'lady-1@s.whatsapp.net' }, { id: 'guy-1@s.whatsapp.net' }, { id: 'unknown@s.whatsapp.net' }];
        const genders = new Map([['lady-1@s.whatsapp.net', 'lady'], ['guy-1@s.whatsapp.net', 'guy']]);
        const getGender = vi.fn(async jid => genders.get(jid) || null);
        await expect(filterParticipantsByGender(participants, 'lady', getGender)).resolves.toEqual(['lady-1@s.whatsapp.net']);
        await expect(filterParticipantsByGender(participants, 'guy', getGender)).resolves.toEqual(['guy-1@s.whatsapp.net']);
        expect(getGender).toHaveBeenCalledTimes(6);
    });
    it('rejects unknown gender requests and never infers missing records', async () => {
        const getGender = vi.fn(async () => null);
        await expect(filterParticipantsByGender([{ id: 'x' }], 'unknown', getGender)).resolves.toEqual([]);
        await expect(filterParticipantsByGender([{ id: 'x' }], 'lady', getGender)).resolves.toEqual([]);
    });
});
