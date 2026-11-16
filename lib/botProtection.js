export const FORGE_GUARD_REPLICATION_REPLY = '😂 Ah, the secret recipe? Nice try. Forge Guard is a finished experience, not a public DIY kit. Enjoy the bot; the workshop tour is fully booked.';

export function isForgeGuardReplicationRequest(value) {
    const text = String(value || '').toLowerCase().replace(/[^a-z0-9@+\s-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text) return false;

    const refersToThisBot = /\b(forge\s*(?:guard|bot)|this bot|your bot|same bot|bot like (?:this|yours|it)|one like (?:this|it))\b/.test(text);
    if (!refersToThisBot) return false;

    return /\b(how (?:can i|do i|to)|teach me|show me|share|send me|give me|where can i get|can i (?:own|get|buy|have)|i want to (?:own|get|build|make)|build|make|create|clone|copy|replicate|recreate|duplicate|source code|github repo|code|setup|hosting|host|api|integration|script|built|written|programmed|stack|framework|architecture)\b/.test(text);
}
