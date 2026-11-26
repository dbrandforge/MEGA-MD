import { describe, expect, it } from 'vitest';
import {
    PRIMARY_FEATURE_GROUP,
    LEGACY_MATURED_MIND_GROUP,
    ADDITIONAL_FEATURE_GROUPS,
    FEATURE_GROUPS
} from '../../lib/featureGroups.js';

describe('Forge Guard master feature group', () => {
    it('uses Matured Minded Room as the protected master group', () => {
        expect(PRIMARY_FEATURE_GROUP).toBe('120363412352644891@g.us');
        expect(FEATURE_GROUPS).toContain(PRIMARY_FEATURE_GROUP);
    });

    it('keeps the retired Matured Minded group out of the default registry', () => {
        expect(LEGACY_MATURED_MIND_GROUP).toBe('120363405434471171@g.us');
        expect(FEATURE_GROUPS).not.toContain(LEGACY_MATURED_MIND_GROUP);
        expect(ADDITIONAL_FEATURE_GROUPS).toContain('120363420924358296@g.us');
    });
});
