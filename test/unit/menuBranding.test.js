import { describe, expect, it, vi } from 'vitest';
import commandHandler from '../../lib/commandHandler.js';
import menuPlugin from '../../plugins/list.js';
import { readFileSync } from 'node:fs';

vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, watch: vi.fn() };
});

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

    it('renders a 200+ owner command inventory and a substantial public menu as text', async () => {
        const loadedCount = await commandHandler.reloadCommands();
        expect(loadedCount).toBeGreaterThan(200);

        const sent = [];
        const sock = {
            sendMessage: vi.fn(async (jid, content) => {
                sent.push({ jid, content });
                return {};
            })
        };
        const chatId = '120363000000000001@g.us';
        const publicMessage = { key: { remoteJid: chatId, fromMe: false } };
        await menuPlugin.handler(sock, publicMessage, [], {
            chatId, senderId: '2348000000000@s.whatsapp.net', channelInfo: {}
        });
        const publicText = sent.at(-1)?.content?.text || '';
        const publicCount = Number(publicText.match(/Commands:\* (\d+)/)?.[1] || 0);
        expect(publicCount).toBeGreaterThan(100);

        const ownerMessage = { key: { remoteJid: chatId, fromMe: true } };
        await menuPlugin.handler(sock, ownerMessage, ['owner'], {
            chatId, senderId: '2348000000000@s.whatsapp.net', channelInfo: {}
        });
        const ownerText = sent.at(-1)?.content?.text || '';
        const ownerCount = Number(ownerText.match(/Commands:\* (\d+)/)?.[1] || 0);
        expect(ownerCount).toBeGreaterThan(200);
        expect(sent.every(item => !item.content.image)).toBe(true);
    });
});
