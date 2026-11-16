import store from '../lib/lightweight_store.js';
import { hasMaturedMindedFeatures } from '../lib/groupFeatureAccess.js';

const LEAVE_ANNOUNCEMENTS_KEY = 'groupLeaveAnnouncementsEnabled';

export default {
    command: 'leaveannounce',
    aliases: ['leaveannouncements', 'leavealert'],
    category: 'admin',
    description: 'Enable or disable voluntary member-leave announcements for this group.',
    usage: '.leaveannounce <on|off|status>',
    adminOnly: true,
    groupOnly: true,
    async handler(sock, message, args, context) {
        const { chatId } = context;
        if (!await hasMaturedMindedFeatures(chatId)) {
            return sock.sendMessage(chatId, {
                text: 'This group has not been registered for the Forge Guard group-lifecycle features.'
            }, { quoted: message });
        }

        const action = String(args?.[0] || 'status').trim().toLowerCase();
        if (!['on', 'off', 'status'].includes(action)) {
            return sock.sendMessage(chatId, {
                text: 'Usage: .leaveannounce on | off | status\nThis controls voluntary member-leave announcements only.'
            }, { quoted: message });
        }

        if (action === 'status') {
            const enabled = await store.getSetting(chatId, LEAVE_ANNOUNCEMENTS_KEY);
            const isEnabled = enabled !== false;
            return sock.sendMessage(chatId, {
                text: `📣 Voluntary leave announcements are currently *${isEnabled ? 'ON' : 'OFF'}* in this group.\nUse .leaveannounce off or .leaveannounce on to change this.`
            }, { quoted: message });
        }

        const enabled = action === 'on';
        const saved = await store.saveSettingVerified(chatId, LEAVE_ANNOUNCEMENTS_KEY, enabled);
        if (!saved) {
            return sock.sendMessage(chatId, {
                text: '❌ I could not save that setting. Please try again.'
            }, { quoted: message });
        }

        return sock.sendMessage(chatId, {
            text: enabled
                ? '✅ Voluntary leave announcements are now *ON*.'
                : '🔕 Voluntary leave announcements are now *OFF*. Member removals by admins will still be announced.'
        }, { quoted: message });
    }
};
