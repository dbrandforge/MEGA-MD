/**
 * Anonymous Night
 * Admin: .anonymous on | .anonymous off | .anonymous link
 * Members use the generated link to submit; bot posts anonymously in group
 */
import store from '../lib/lightweight_store.js';
import { isGameAllowed } from './daylock.js';
import config from '../config.js';

const TARGET_GROUP = '120363405434471171@g.us';
const ANON_KEY = 'anonymousState';

async function getState(chatId) {
    return (await store.getSetting(chatId, ANON_KEY)) || { enabled: false, submissions: [] };
}

async function saveState(chatId, state) {
    await store.saveSetting(chatId, ANON_KEY, state);
}

export default {
    command: 'anonymous',
    aliases: ['anon', 'anonymousnight'],
    category: 'games',
    description: 'Anonymous Night controls',
    usage: '.anonymous on|off|link|status',
    groupOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo, isSenderAdmin, senderIsOwnerOrSudo } = context;
        const action = (args[0] || '').toLowerCase();

        if (chatId !== TARGET_GROUP) {
            return sock.sendMessage(chatId, {
                text: 'Anonymous Night is for the Mature minded group only.',
                ...channelInfo
            }, { quoted: message });
        }

        const allowed = await isGameAllowed(chatId, 'anonymous');
        // Admins can still toggle for setup
        const isAdminUser = isSenderAdmin || senderIsOwnerOrSudo;

        if (!action || action === 'status' || action === 'link') {
            const state = await getState(chatId);
            // Link points to bot web server + group id
            const base = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || 'https://mega-md-bot-rky6.onrender.com';
            const link = `${base.replace(/\/$/, '')}/anon/${chatId.split('@')[0]}`;

            return sock.sendMessage(chatId, {
                text: `🕵️ *Anonymous Night*\n\nStatus: ${state.enabled ? '🟢 OPEN' : '🔴 CLOSED'}\n\n` +
                    (state.enabled
                        ? `Submit anonymously here:\n${link}\n\nMessages/images sent on that page are posted here without your name.`
                        : `Admin must open it with *.anonymous on* (Saturday or with bypass).`),
                ...channelInfo
            }, { quoted: message });
        }

        if (!isAdminUser) {
            return sock.sendMessage(chatId, {
                text: 'Only admins can open/close Anonymous Night.',
                ...channelInfo
            }, { quoted: message });
        }

        if (action === 'on') {
            if (!allowed.ok && !isAdminUser) {
                return sock.sendMessage(chatId, { text: allowed.msg, ...channelInfo }, { quoted: message });
            }
            const state = await getState(chatId);
            state.enabled = true;
            await saveState(chatId, state);

            const base = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || 'https://mega-md-bot-rky6.onrender.com';
            const link = `${base.replace(/\/$/, '')}/anon/${chatId.split('@')[0]}`;

            return sock.sendMessage(chatId, {
                text: `🟢 *Anonymous Night is OPEN*\n\nSend confessions / fantasies / secrets here:\n${link}\n\nThey will be posted in the group as anonymous images/text.\n\nClose with *.anonymous off*`,
                ...channelInfo
            });
        }

        if (action === 'off') {
            const state = await getState(chatId);
            state.enabled = false;
            await saveState(chatId, state);
            return sock.sendMessage(chatId, {
                text: '🔴 *Anonymous Night is CLOSED.*',
                ...channelInfo
            }, { quoted: message });
        }

        return sock.sendMessage(chatId, {
            text: 'Usage: .anonymous on | off | link | status',
            ...channelInfo
        }, { quoted: message });
    }
};

/** Called by web server when a new anon submission arrives */
export async function postAnonymousSubmission(sock, chatId, { text, imageBuffer }) {
    const state = await getState(chatId);
    if (!state.enabled) return false;

    if (imageBuffer) {
        await sock.sendMessage(chatId, {
            image: imageBuffer,
            caption: text ? `🕵️ *Anonymous*\n\n${text}` : '🕵️ *Anonymous submission*'
        });
    } else if (text) {
        await sock.sendMessage(chatId, {
            text: `🕵️ *Anonymous*\n\n${text}`
        });
    }
    return true;
}
