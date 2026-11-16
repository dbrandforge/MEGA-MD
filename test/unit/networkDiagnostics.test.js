import { describe, expect, it } from 'vitest';
import {
    classifyNetworkDestination,
    createEgressWindow,
} from '../../lib/networkDiagnostics.js';

describe('outbound network diagnostics', () => {
    it('classifies known service destinations without exposing full hostnames', () => {
        expect(classifyNetworkDestination({ hostname: 'cluster0-shard-00-00.example.mongodb.net', port: 27017 })).toBe('mongodb');
        expect(classifyNetworkDestination({ hostname: 'web.whatsapp.com', port: 443 })).toBe('whatsapp');
        expect(classifyNetworkDestination({ hostname: 'generativelanguage.googleapis.com', port: 443 })).toBe('google_ai');
        expect(classifyNetworkDestination({ hostname: 'api.groq.com', port: 443 })).toBe('groq_ai');
        expect(classifyNetworkDestination({ hostname: 'api.openai.com', port: 443 })).toBe('openai_ai');
    });

    it('groups unknown destinations by domain only, never URL paths or request content', () => {
        expect(classifyNetworkDestination({
            hostname: 'media.api.example.co.uk',
            remoteAddress: '203.0.113.10',
            port: 443,
        })).toBe('external:example.co.uk');
    });

    it('ignores private and local destinations', () => {
        expect(classifyNetworkDestination({ remoteAddress: '127.0.0.1', port: 5000 })).toBe('private_or_local');
        expect(classifyNetworkDestination({ remoteAddress: '10.0.0.8', port: 27017 })).toBe('private_or_local');
    });

    it('aggregates bytes, write counts and distinct sockets by destination', () => {
        const window = createEgressWindow();
        const socketA = {};
        const socketB = {};
        window.record('whatsapp', 120, socketA);
        window.record('whatsapp', 80, socketA);
        window.record('mongodb', 300, socketB);

        expect(window.snapshot()).toEqual({
            totalBytes: 500,
            totalMiB: 0,
            breakdown: [
                { destination: 'mongodb', bytes: 300, mib: 0, writes: 1, sockets: 1 },
                { destination: 'whatsapp', bytes: 200, mib: 0, writes: 2, sockets: 1 },
            ],
        });

        window.clear();
        expect(window.snapshot()).toMatchObject({ totalBytes: 0, breakdown: [] });
    });
});
