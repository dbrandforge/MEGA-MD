import { describe, expect, it } from 'vitest';
import { FORGE_GUARD_REPLICATION_REPLY, isForgeGuardReplicationRequest } from '../../lib/botProtection.js';

describe('Forge Guard replication inquiry protection', () => {
    it.each([
        'How do I build a bot like this?',
        'Can I own Forge Guard?',
        'Please share the source code for your bot',
        'How was Forge Bot built and what API does it use?',
        'I want to replicate this bot'
    ])('detects targeted cloning inquiry: %s', message => {
        expect(isForgeGuardReplicationRequest(message)).toBe(true);
    });

    it.each([
        'How do I build a website?',
        'Can you explain what a chatbot is?',
        'What is the best API for my business?',
        'Forge Guard is very helpful',
        ''
    ])('does not intercept unrelated conversation: %s', message => {
        expect(isForgeGuardReplicationRequest(message)).toBe(false);
    });

    it('provides a fixed reply without technical implementation details', () => {
        expect(FORGE_GUARD_REPLICATION_REPLY).toContain('not a public DIY kit');
        expect(FORGE_GUARD_REPLICATION_REPLY).not.toMatch(/github|render|mongo|gemini|source code/i);
    });
});
