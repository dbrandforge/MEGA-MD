import { canonicalWhatsAppUserId } from '../lib/whatsappIdentity.js';
import { isRootCreator, addCreatorAccount, removeCreatorAccount, listCreatorAccounts } from '../lib/creatorRegistry.js';

function getMentionedUsers(message) {
    const info = message?.message?.extendedTextMessage?.contextInfo
        || message?.message?.imageMessage?.contextInfo
        || message?.message?.videoMessage?.contextInfo
        || {};
    return [...new Set((info.mentionedJid || []).filter(Boolean))];
}

export default {
    command: 'creator',
    aliases: ['creators'],
    category: 'owner',
    description: 'Manage additional creator accounts (root creators only).',
    usage: '.creator add @user | .creator remove @user | .creator list',
    strictOwnerOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        if (!isRootCreator(context.senderId)) {
            return sock.sendMessage(chatId, {
                text: '⛔ Only the two original Forge creator accounts can add or remove creators. Added creators cannot manage this registry.'
            }, { quoted: message });
        }

        const action = String(args?.[0] || 'list').toLowerCase();
        if (action === 'list') {
            const registry = await listCreatorAccounts();
            const roots = registry.roots.map((number, index) => `${index + 1}. +${number} — ROOT CREATOR`);
            const added = registry.added.length
                ? registry.added.map((number, index) => `${index + 1}. +${number} — ADDED CREATOR`)
                : ['None'];
            return sock.sendMessage(chatId, {
                text: `👑 *FORGE CREATOR REGISTRY*\n\n*Protected root creators*\n${roots.join('\n')}\n\n*Additional creators*\n${added.join('\n')}\n\nAdded creators have creator-level command access but cannot manage this registry.`
            }, { quoted: message });
        }

        if (!['add', 'remove'].includes(action)) {
            return sock.sendMessage(chatId, {
                text: 'Usage:\n• *.creator add @user*\n• *.creator remove @user*\n• *.creator list*'
            }, { quoted: message });
        }

        const mentions = getMentionedUsers(message);
        if (mentions.length !== 1) {
            return sock.sendMessage(chatId, {
                text: `Tag exactly one WhatsApp account: *.creator ${action} @user*.`
            }, { quoted: message });
        }
        const target = await canonicalWhatsAppUserId(sock, mentions[0]) || mentions[0];
        const result = action === 'add'
            ? await addCreatorAccount(target)
            : await removeCreatorAccount(target);

        let text;
        if (result.reason === 'protected-root') {
            text = '🛡️ That account is a protected root creator and cannot be removed.';
        } else if (result.reason === 'exists') {
            text = 'ℹ️ That account is already registered as an additional creator.';
        } else if (result.reason === 'missing') {
            text = 'ℹ️ That account is not in the additional creator registry.';
        } else if (result.added) {
            text = `✅ +${result.number} has been added as a creator. Creator-level commands are now available to that account; creator management remains restricted to the two original Forge accounts.`;
        } else if (result.removed) {
            text = `♻️ +${result.number} has been removed from the creator registry. Additional creator privileges have been revoked.`;
        } else {
            text = '❌ The creator registry was not changed.';
        }
        return sock.sendMessage(chatId, { text }, { quoted: message });
    }
};
