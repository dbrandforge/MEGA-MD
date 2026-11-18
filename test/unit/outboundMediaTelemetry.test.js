import { describe, expect, it } from 'vitest';
import { classifyOutboundPayload, createOutboundMediaTelemetry } from '../../lib/outboundMediaTelemetry.js';

describe('outbound media telemetry', () => {
    it('classifies text without retaining its content', () => {
        expect(classifyOutboundPayload({ text: 'hello' })).toEqual({
            type: 'text',
            source: 'none',
            knownBytes: 0,
            textBytes: 5
        });
    });

    it('counts in-memory media buffers without copying them', () => {
        const payload = Buffer.alloc(128);
        expect(classifyOutboundPayload({ image: payload })).toEqual({
            type: 'image',
            source: 'buffer',
            knownBytes: 128,
            textBytes: 0
        });
    });

    it('identifies remote media URLs without claiming their size', () => {
        expect(classifyOutboundPayload({ audio: { url: 'https://media.example/audio.mp3' } })).toEqual({
            type: 'audio',
            source: 'remote_url',
            knownBytes: 0,
            textBytes: 0
        });
    });

    it('uses bounded aggregate counters and resets each reporting window', () => {
        const telemetry = createOutboundMediaTelemetry();
        telemetry.record({ type: 'video', source: 'remote_url', knownBytes: 0, textBytes: 4 }, 20);
        telemetry.record({ type: 'image', source: 'buffer', knownBytes: 256, textBytes: 0 }, 30, true);

        const first = telemetry.drain();
        expect(first.sends).toBe(2);
        expect(first.failures).toBe(1);
        expect(first.types.video).toBe(1);
        expect(first.types.image).toBe(1);
        expect(first.sources.remote_url).toBe(1);
        expect(first.sources.buffer).toBe(1);
        expect(first.knownMediaBytes).toBe(256);
        expect(first.maxDurationMs).toBe(30);
        expect(telemetry.drain().sends).toBe(0);
    });
});
