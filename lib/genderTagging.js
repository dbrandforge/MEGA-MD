/**
 * Resolve gender-tag recipients from the group's current participant roster.
 * Unknown or unset genders are intentionally excluded; never infer gender.
 */
export async function filterParticipantsByGender(participants, gender, getGender) {
    const expected = String(gender || '').toLowerCase();
    if (!['guy', 'lady'].includes(expected) || typeof getGender !== 'function') return [];
    const entries = await Promise.all((participants || []).map(async participant => {
        const jid = participant?.id || participant?.phoneNumber || participant?.lid;
        if (!jid) return null;
        try { return await getGender(jid) === expected ? jid : null; }
        catch { return null; }
    }));
    return [...new Set(entries.filter(Boolean))];
}
