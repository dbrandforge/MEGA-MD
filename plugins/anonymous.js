/**
 * Anonymous Night
 * Admin: .anonymous on | off | link | status
 */
import store from '../lib/lightweight_store.js';
import { isGameAllowed } from './daylock.js';
import config from '../config.js';
import isAdmin from '../lib/isAdmin.js';
import { isFeatureGroup } from '../lib/featureGroups.js';

const ANON_KEY = 'anonymousState';

function numMatch(a, b) {
    const x = String(a || '').replace(/\D/g, '');
    const y = String(b || '').replace(/\D/g, '');
    return x && y && (x === y || x.endsWith(y) || y.endsWith(x));
}

async function getState(chatId) {
    return (await store.getSetting(chatId, ANON_KEY)) || { enabled: false };
}
async function saveState(chatId, state) {
    await store.saveSetting(chatId, ANON_KEY, state);
}

function getPublicBaseUrl() {
    return (process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || 'https://mega-md-bot-9o7f.onrender.com').replace(/\/$/, '');
}
function getAnonymousLink(chatId) {
    return `${getPublicBaseUrl()}/anon/${chatId.split('@')[0]}`;
}

export default {
    command: 'anonymous',
    aliases: ['anon', 'anonymousnight'],
    category: 'games',
    description: 'Anonymous Night controls',
    usage: '.anonymous on|off|link|status',
    groupOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo, isSenderAdmin, senderIsOwnerOrSudo, isOwnerOrSudoCheck } = context;
        const action = (args[0] || '').toLowerCase();

        if (!isFeatureGroup(chatId)) {
            return sock.sendMessage(chatId, {
                text: 'Anonymous Night is not enabled for this group.',
                ...channelInfo
            }, { quoted: message });
        }

        let adminNow = !!(isSenderAdmin || senderIsOwnerOrSudo || isOwnerOrSudoCheck || message.key.fromMe);
        if (!adminNow) {
            try {
                const st = await isAdmin(sock, chatId, senderId);
                adminNow = !!st.isSenderAdmin;
            } catch {}
        }
        if (!adminNow && numMatch(senderId, config.ownerNumber)) adminNow = true;

        const allowed = await isGameAllowed(chatId, 'anonymous');

        if (!action || action === 'status' || action === 'link') {
            const state = await getState(chatId);
            const link = getAnonymousLink(chatId);
            return sock.sendMessage(chatId, {
                text: `🕵️ *Anonymous Night*\n\nStatus: ${state.enabled ? '🟢 OPEN' : '🔴 CLOSED'}\n\n` +
                    (state.enabled
                        ? `Submit anonymously:\n${link}\n\nPosted here without your name.`
                        : `Admin: *.anonymous on* (Saturday or with bypass).`),
                ...channelInfo
            }, { quoted: message });
        }

        if (!adminNow) {
            return sock.sendMessage(chatId, {
                text: 'Only *admins / owner / sudo* can open or close Anonymous Night.',
                ...channelInfo
            }, { quoted: message });
        }

        if (action === 'on') {
            const state = await getState(chatId);
            state.enabled = true;
            await saveState(chatId, state);
            const link = getAnonymousLink(chatId);
            return sock.sendMessage(chatId, {
                text: `🟢 *Anonymous Night is OPEN*\n\nSubmit here:\n${link}\n\nClose: *.anonymous off*` +
                    (!allowed.ok ? `\n\n_(Opened by admin off scheduled day)_` : ''),
                ...channelInfo
            }, { quoted: message });
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
