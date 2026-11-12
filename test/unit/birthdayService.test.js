import { describe, expect, it } from 'vitest';
import {
    parseBirthdayDate,
    formatBirthdayDate,
    normalizeBirthdayUserId,
    getLagosDateParts
} from '../../lib/birthdayService.js';

describe('birthday service helpers', () => {
    it('parses valid day/month dates and rejects invalid dates', () => {
        expect(parseBirthdayDate('24/09')).toEqual({ day: 24, month: 9 });
        expect(parseBirthdayDate('29-02')).toEqual({ day: 29, month: 2 });
        expect(parseBirthdayDate('31/04')).toBeNull();
        expect(parseBirthdayDate('00/12')).toBeNull();
        expect(parseBirthdayDate('2026-09-24')).toBeNull();
    });

    it('formats dates consistently', () => {
        expect(formatBirthdayDate({ day: 4, month: 2 })).toBe('04/02');
    });

    it('normalizes WhatsApp JIDs for identity keys', () => {
        expect(normalizeBirthdayUserId('2348000000000:12@s.whatsapp.net')).toBe('2348000000000');
        expect(normalizeBirthdayUserId('2348000000000@s.whatsapp.net')).toBe('2348000000000');
    });

    it('uses Lagos local time for delivery scheduling', () => {
        const parts = getLagosDateParts(new Date('2026-11-12T07:00:00.000Z'));
        expect(parts).toMatchObject({ year: 2026, month: 11, day: 12, hour: 8, minute: 0 });
    });
});
