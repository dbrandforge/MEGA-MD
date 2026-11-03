import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('Forge Guard menu branding', () => {
    it('does not attach the legacy thumbnail to public or owner menus', () => {
        const menu = source('../../plugins/list.js');
        expect(menu).not.toContain('assets/thumb.png');
        expect(menu).not.toContain('GlobalTechInfo');
    });

    it('does not attach former-owner newsletter metadata to the smart menu', () => {
        const smartMenu = source('../../plugins/smartmenu.js');
        expect(smartMenu).not.toContain('GlobalTechInc');
        expect(smartMenu).not.toContain('forwardedNewsletterMessageInfo');
        expect(smartMenu).not.toContain('assets/thumb.png');
    });

    it('does not use a former-owner preview image in settings', () => {
        const settings = source('../../plugins/settings.js');
        expect(settings).not.toContain('GlobalTechInfo');
        expect(settings).not.toContain('thumbnailUrl');
        expect(settings).toContain('FORGE GUARD SETTINGS');
    });
});
