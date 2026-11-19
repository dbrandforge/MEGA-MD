// Master switch for features that track or message the whole member list of a
// large group (welcome/goodbye, member history, intro reminders, per-member
// profiles/rosters, read-receipt tracking, weekly member counts).
//
// They are OFF by default because they create heavy per-message and
// per-member database and CPU work in 700+ member groups. Set
// MEMBER_FEATURES=on in the environment to enable them again. No stored data
// is deleted either way.
export const MEMBER_FEATURES_ENABLED = String(process.env.MEMBER_FEATURES || '').toLowerCase() === 'on';
