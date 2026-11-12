import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/lightweight_store.js', () => ({
    default: {
        getSetting: vi.fn(),
        saveSetting: vi.fn(),
        saveSettingVerified: vi.fn()
    }
}));

import store from '../../lib/lightweight_store.js';
import { recordGroupInteraction, buildGroupContinuityContext } from '../../lib/chatbotGroupMemory.js';

const group = '120363000000000000@g.us';
const member = '2348011111111@s.whatsapp.net';
const askingMember = '2348022222222@s.whatsapp.net';
let settings;

describe('Forge Guard group-local member continuity', () => {
    beforeEach(() => {
        settings = new Map();
        vi.clearAllMocks();
        store.getSetting.mockImplementation(async (chatId, key) => settings.get(`${chatId}:${key}`) || null);
        store.saveSettingVerified.mockImplementation(async (chatId, key, value) => {
            settings.set(`${chatId}:${key}`, value);
            return true;
        });
    });

    it('remembers only public messages in the group where they were sent', async () => {
        await recordGroupInteraction(group, member, 'Adunni', 'I am planning a new launch', 'english');
        const context = await buildGroupContinuityContext(group, askingMember, 'What has Adunni done this time?');
        expect(context).toContain('Adunni');
        expect(context).toContain('I am planning a new launch');
        expect(context).toContain('GROUP-LOCAL CONTINUITY');
    });

    it('does not expose another group’s member history', async () => {
        await recordGroupInteraction(group, member, 'Adunni', 'A group-only update', 'pidgin');
        const context = await buildGroupContinuityContext('another-group@g.us', askingMember, 'Adunni');
        expect(context).toBe('');
    });

    it('does not include the asking participant as another member', async () => {
        await recordGroupInteraction(group, member, 'Adunni', 'Previous contribution', 'english');
        const context = await buildGroupContinuityContext(group, member, 'Who am I?');
        expect(context).toBe('');
    });
});
