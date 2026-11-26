/**
 * Resolve gender-tag recipients from the group's current participant roster.
 * Unknown or unset genders are intentionally excluded; never infer gender.
 * Bound concurrent lookups to avoid flooding storage in large groups.
 */
export async function filterParticipantsByGender(participants, gender, getGender) {
    const expected = String(gender || '').toLowerCase();
    if (!['guy', 'lady'].includes(expected) || typeof getGender !== 'function') return [];

    const matches = [];
    const roster = Array.isArray(participants) ? participants : [];
    const batchSize = 50;
    for (let offset = 0; offset < roster.length; offset += batchSize) {
        const batch = roster.slice(offset, offset + batchSize);
        const entries = await Promise.all(batch.map(async participant => {
            const jid = participant?.id || participant?.phoneNumber || participant?.lid;
            if (!jid) return null;
            try { return await getGender(jid) === expected ? jid : null; }
            catch { return null; }
        }));
        matches.push(...entries.filter(Boolean));
    }
    return [...new Set(matches)];
}
