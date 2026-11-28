import { isRootCreator } from '../lib/creatorRegistry.js';
import { addRestrictedAdmin, removeRestrictedAdmin } from '../lib/restrictedAdminRegistry.js';

async function handlePromotionEvent(sock, groupId, participants, author) {
    try {
        if (!Array.isArray(participants) || participants.length === 0) return;
        const promotedUsernames = participants.map(jid => {
            const value = typeof jid === 'string' ? jid : (jid.id || jid.toString());
            return `@${value.split('@')[0]}`;
        });
        const mentionList = participants.map(jid => typeof jid === 'string' ? jid : (jid.id || jid.toString()));
        const authorJid = author ? (typeof author === 'string' ? author : (author.id || author.toString())) : null;
        if (authorJid) mentionList.push(authorJid);
        const promotedBy = authorJid ? `@${authorJid.split('@')[0]}` : 'System';
        await sock.sendMessage(groupId, {
            text: `*『 GROUP PROMOTION 』*\\n\\n👥 *Promoted User${participants.length > 1 ? 's' : ''}:*\\n${promotedUsernames.map(name => `• ${name}`).join('\\n')}\\n\\n👑 *Promoted By:* ${promotedBy}\\n\\n📅 *Date:* ${new Date().toLocaleString()}`,
            mentions: mentionList
        });
    } catch (error) {
        console.error('Error handling promotion event:', error);
    }
}

export default {
    command: 'promote',
    aliases: ['admin'],
    category: 'admin',
    description: 'Promote user(s) to full admin, or root-creator-only restricted admin',
    usage: '.promote @user | .promote restricted @user',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo } = context;
        const restrictedMode = String(args?.[0] || '').toLowerCase() === 'restricted';
        if (restrictedMode && !isRootCreator(context.senderId)) {
            return sock.sendMessage(chatId, {
                text: '⛔ Only a protected root creator can grant restricted-admin status.',
                ...channelInfo
            }, { quoted: message });
        }

        const mentionedJids = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const replied = message.message?.extendedTextMessage?.contextInfo?.participant;
        const targets = mentionedJids.length ? mentionedJids : (replied ? [replied] : []);
        if (!targets.length) {
            return sock.sendMessage(chatId, {
                text: 'Mention a member or reply to their message. Use *.promote @user* for full admin or *.promote restricted @user* for restricted admin.',
                ...channelInfo
            }, { quoted: message });
        }
        if (targets.length > 1 && restrictedMode) {
            return sock.sendMessage(chatId, { text: 'Promote one restricted admin at a time so each permission change can be verified.', ...channelInfo }, { quoted: message });
        }

        const restrictedTargets = [];
        try {
            if (restrictedMode) {
                for (const target of targets) {
                    const added = await addRestrictedAdmin(chatId, target);
                    restrictedTargets.push(target);
                    if (!added) {
                        return sock.sendMessage(chatId, { text: 'ℹ️ That member is already registered as a restricted admin. No duplicate permission record was created.', ...channelInfo }, { quoted: message });
                    }
                }
            } else {
                for (const target of targets) await removeRestrictedAdmin(chatId, target);
            }

            await sock.groupParticipantsUpdate(chatId, targets, 'promote');
            const names = targets.map(jid => `@${jid.split('@')[0]}`);
            const actor = context.senderId || sock.user?.id || '';
            await sock.sendMessage(chatId, {
                text: `*『 GROUP PROMOTION 』*\\n\\n👥 *Promoted:*\\n${names.map(name => `• ${name}`).join('\\n')}\\n\\n${restrictedMode
                    ? '🛡️ *ROLE: RESTRICTED ADMIN*\\nWhatsApp admin status granted. Bot moderation, management and command-control privileges remain disabled. Games, activities and normal chatbot conversations remain available.'
                    : '👑 *ROLE: FULL ADMIN*\\nWhatsApp admin status and the existing admin command permissions are enabled.'}\\n\\n📅 *Date:* ${new Date().toLocaleString()}`,
                mentions: [...targets, actor].filter(Boolean),
                ...channelInfo
            }, { quoted: message });
        } catch (error) {
            if (restrictedMode) {
                for (const target of restrictedTargets) {
                    try { await removeRestrictedAdmin(chatId, target); } catch (rollbackError) {
                        console.error('[PROMOTE] Restricted-role rollback failed:', rollbackError.message);
                    }
                }
            }
            console.error('Error in promote command:', error);
            await sock.sendMessage(chatId, {
                text: '❌ Promotion failed. The role change was not reported as successful. Check the bot’s group-admin permission and retry.',
                ...channelInfo
            }, { quoted: message });
        }
    },
    handlePromotionEvent
};
