import { normalizeConversationParticipant } from './chatbotConversationMemory.js';

// Group-wide member histories and rosters are intentionally disabled.
// Forge Guard keeps personal memory only for the verified creator and queen;
// it does not build persistent profiles or interaction histories for group members.
export function normalizeGroupMemberId(senderId) {
    return normalizeConversationParticipant(senderId);
}

export async function recordGroupInteraction() {
    return null;
}

export async function getGroupMemberProfile() {
    return null;
}

export async function buildGroupContinuityContext() {
    return '';
}

export async function flushPendingGroupRosterWrites() {
    return 0;
}

export function clearGroupMemoryCache() {
    return undefined;
}

global.__forgeGroupRosterCacheSize = () => 0;
global.__forgeFlushGroupMemory = () => flushPendingGroupRosterWrites();
