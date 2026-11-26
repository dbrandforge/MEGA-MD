import { isConfiguredOwner } from '../lib/isOwner.js';

export default {
    command: 'kick',
    aliases: ['remove', 'fire'],
    category: 'admin',
    description: 'Remove user(s) from the group',
    usage: '.kick @user or reply to message',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const isBotAdmin = context.isBotAdmin;
        if (!isBotAdmin) {
            await sock.sendMessage(chatId, {
                text: '❌ *Please make the bot an admin first*'
            }, { quoted: message });
            return;
        }
        let usersToKick = [];
        const mentionedJids = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
        if (mentionedJids && mentionedJids.length > 0) {
            usersToKick = mentionedJids;
        }
        else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            usersToKick = [message.message.extendedTextMessage.contextInfo.participant];
        }
        if (usersToKick.length === 0) {
            await sock.sendMessage(chatId, {
                text: '❌ *Please mention a user or reply to their message*\n\nUsage: `.kick @user` or reply with `.kick`'
            }, { quoted: message });
            return;
        }
        const botId = sock.user?.id || '';
        const botLid = sock.user?.lid || '';
        const botPhoneNumber = botId.includes(':') ? botId.split(':')[0] : (botId.includes('@') ? botId.split('@')[0] : botId);
        const botIdFormatted = `${botPhoneNumber }@s.whatsapp.net`;
        const botLidNumeric = botLid.includes(':') ? botLid.split(':')[0] : (botLid.includes('@') ? botLid.split('@')[0] : botLid);
        const botLidWithoutSuffix = botLid.includes('@') ? botLid.split('@')[0] : botLid;
        let metadata;
        try { metadata = await sock.groupMetadata(chatId); }
        catch {
            await sock.sendMessage(chatId, { text: '❌ I could not verify the target members’ roles. No one was removed.' }, { quoted: message });
            return;
        }
        const participants = metadata.participants || [];
        const actorIsCreator = Boolean(context.isCreatorOrBot || isConfiguredOwner(context.senderId));
        const cleanIdentity = value => String(value || '').split(':')[0].split('@')[0];
        const matchedTargets = usersToKick.map(userId => {
            const target = participants.find(p => [p.id, p.lid, p.phoneNumber].some(value =>
                value && (value === userId || cleanIdentity(value) === cleanIdentity(userId))
            ));
            const identities = [userId, target?.id, target?.lid, target?.phoneNumber].filter(Boolean);
            return { userId, target, isCreator: identities.some(isConfiguredOwner), isAdmin: target?.admin === 'admin' || target?.admin === 'superadmin' };
        });
        if (matchedTargets.some(item => item.isCreator)) {
            await sock.sendMessage(chatId, { text: actorIsCreator
                ? '🛡️ My Creator is not a removal target. Even creator privileges have limits when it comes to protecting the Creator. 😂'
                : '🚨 You lack respect! You want to remove my Creator? I’m sorry, I cannot remove the person who created me. Who are you to instigate me against my Creator? 😂🛡️'
            }, { quoted: message });
            return;
        }
        if (matchedTargets.some(item => !item.target)) {
            await sock.sendMessage(chatId, { text: '❌ One or more targets could not be confirmed as current group members. No one was removed.' }, { quoted: message });
            return;
        }
        if (!actorIsCreator && matchedTargets.some(item => item.isAdmin)) {
            await sock.sendMessage(chatId, { text: '⛔ Admins cannot remove fellow admins. My Creator alone can override that boundary.' }, { quoted: message });
            return;
        }
        const isTryingToKickBot = usersToKick.some((userId) => {
            const userPhoneNumber = userId.includes(':') ? userId.split(':')[0] : (userId.includes('@') ? userId.split('@')[0] : userId);
            const userLidNumeric = userId.includes('@lid') ? userId.split('@')[0].split(':')[0] : '';
            const directMatch = (userId === botId ||
                userId === botLid ||
                userId === botIdFormatted ||
                userPhoneNumber === botPhoneNumber ||
                (userLidNumeric && botLidNumeric && userLidNumeric === botLidNumeric));
            if (directMatch) {
                return true;
            }
            const participantMatch = participants.some((p) => {
                const pPhoneNumber = p.phoneNumber ? p.phoneNumber.split('@')[0] : '';
                const pId = p.id ? p.id.split('@')[0] : '';
                const pLid = p.lid ? p.lid.split('@')[0] : '';
                const pFullId = p.id || '';
                const pFullLid = p.lid || '';
                const pLidNumeric = pLid.includes(':') ? pLid.split(':')[0] : pLid;
                const isThisParticipantBot = (pFullId === botId ||
                    pFullLid === botLid ||
                    pLidNumeric === botLidNumeric ||
                    pPhoneNumber === botPhoneNumber ||
                    pId === botPhoneNumber ||
                    p.phoneNumber === botIdFormatted ||
                    (botLid && pLid && botLidWithoutSuffix === pLid));
                if (isThisParticipantBot) {
                    return (userId === pFullId ||
                        userId === pFullLid ||
                        userPhoneNumber === pPhoneNumber ||
                        userPhoneNumber === pId ||
                        userId === p.phoneNumber ||
                        (pLid && userLidNumeric && userLidNumeric === pLidNumeric) ||
                        (userLidNumeric && pLidNumeric && userLidNumeric === pLidNumeric));
                }
                return false;
            });
            return participantMatch;
        });
        if (isTryingToKickBot) {
            await sock.sendMessage(chatId, {
                text: "❌ *I can't kick myself* 🤖"
            }, { quoted: message });
            return;
        }
        try {
            await sock.groupParticipantsUpdate(chatId, usersToKick, "remove");
            const usernames = await Promise.all(usersToKick.map(async (jid) => {
                return `@${jid.split('@')[0]}`;
            }));
            await sock.sendMessage(chatId, {
                text: `🚫 *User${usersToKick.length > 1 ? 's' : ''} Removed*\n\n${usernames.join(', ')} has been kicked from the group!`,
                mentions: usersToKick
            }, { quoted: message });
        }
        catch (error) {
            console.error('Error in kick command:', error);
            await sock.sendMessage(chatId, {
                text: '❌ *Failed to kick user(s)*\n\nMake sure the bot has sufficient permissions.'
            }, { quoted: message });
        }
    }
};
