import { describe, expect, it, vi } from 'vitest';
import { filterParticipantsByGender } from '../../lib/genderTagging.js';

describe('gender-based group tagging', () => {
    it('includes only participants whose saved gender matches the requested group', async () => {
        const participants = [
            { id: 'lady-1@s.whatsapp.net' }, { id: 'guy-1@s.whatsapp.net' },
            { id: 'unknown@s.whatsapp.net' }, { id: 'lady-2@lid' }
        ];
        const genders = new Map([
            ['lady-1@s.whatsapp.net', 'lady'], ['guy-1@s.whatsapp.net', 'guy'], ['lady-2@lid', 'lady']
        ]);
        const getGender = vi.fn(async jid => genders.get(jid) || null);
        await expect(filterParticipantsByGender(participants, 'lady', getGender))
            .resolves.toEqual(['lady-1@s.whatsapp.net', 'lady-2@lid']);
        await expect(filterParticipantsByGender(participants, 'guy', getGender))
            .resolves.toEqual(['guy-1@s.whatsapp.net']);
    });
    it('excludes unknown genders and duplicate identities', async () => {
        const participants = [
            { id: 'member@s.whatsapp.net' }, { id: 'member@s.whatsapp.net' }, { id: 'unset@s.whatsapp.net' }
        ];
        await expect(filterParticipantsByGender(participants, 'lady', async jid =>
            jid.startsWith('member@') ? 'lady' : null
        )).resolves.toEqual(['member@s.whatsapp.net']);
    });
    it('rejects unsupported gender values safely', async () => {
        await expect(filterParticipantsByGender([{ id: 'x@s.whatsapp.net' }], 'unknown', vi.fn()))
            .resolves.toEqual([]);
    });
});
