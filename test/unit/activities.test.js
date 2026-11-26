import { describe, expect, it } from 'vitest';
import { buildAllActivitiesMessage } from '../../plugins/activities.js';

describe('weekly group activities list', () => {
    it('includes all seven days and the Thursday PICK YOUR SIN game in one message', () => {
        const message = buildAllActivitiesMessage();
        for (const day of ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']) {
            expect(message).toContain(day);
        }
        expect(message).toContain('PICK YOUR SIN — Thursday Game');
        expect(message).toContain('.picksin start');
        expect(message).toContain('FULL WEEKLY GROUP ACTIVITIES');
    });
});
