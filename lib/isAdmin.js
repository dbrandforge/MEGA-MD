import { isConfiguredOwner } from './isOwner.js';
async function isAdmin(sock, chatId, senderId) {
    try {
        const metadata = await sock.groupMetadata(chatId);
        const participants = metadata.participants || [];

        // Normalize bot identity
        const botId = sock.user?.id || '';
        const botLid = sock.user?.lid || '';
        const botNumber = (botId.split(':')[0] || botId).split('@')[0];
        const botLidNumber = (botLid.split(':')[0] || botLid).split('@')[0];

        // Helper to check if a participant matches the bot
        const isBotParticipant = (p) => {
            const pId = (p.id || '').split('@')[0].split(':')[0];
            const pLid = (p.lid || '').split('@')[0].split(':')[0];
            const pPhone = (p.phoneNumber || '').split('@')[0].split(':')[0];

            return (
                pId === botNumber ||
                pLid === botNumber ||
                pPhone === botNumber ||
                pId === botLidNumber ||
                pLid === botLidNumber ||
                pPhone === botLidNumber ||
                (botId && (p.id === botId || p.lid === botId)) ||
                (botLid && (p.id === botLid || p.lid === botLid))
            );
        };

        // Helper to check if a participant matches the sender
        const isSenderParticipant = (p) => {
            const senderNumber = (senderId || '').split('@')[0].split(':')[0];
            const pId = (p.id || '').split('@')[0].split(':')[0];
            const pLid = (p.lid || '').split('@')[0].split(':')[0];
            const pPhone = (p.phoneNumber || '').split('@')[0].split(':')[0];

            return (
                pId === senderNumber ||
                pLid === senderNumber ||
                pPhone === senderNumber ||
                p.id === senderId ||
                p.lid === senderId
            );
        };

        const isBotAdmin = participants.some(p => 
            isBotParticipant(p) && (p.admin === 'admin' || p.admin === 'superadmin')
        );

        const isSenderAdmin = participants.some(p => 
            isSenderParticipant(p) && (p.admin === 'admin' || p.admin === 'superadmin')
        );

        const senderNumber = (senderId || '').split('@')[0].split(':')[0];
        const isBotSender = Boolean(senderNumber && (
            senderNumber === botNumber ||
            senderNumber === botLidNumber
        ));
        // Creator/owner and the bot account are privileged command operators,
        // not actual WhatsApp admins. isBotAdmin remains the real WhatsApp permission.
        const hasCreatorPrivilege = isConfiguredOwner(senderId) || isBotSender;
        return { isSenderAdmin: isSenderAdmin || hasCreatorPrivilege, isBotAdmin };
    } catch (err) {
        console.error('❌ Error in isAdmin:', err);
        const senderNumber = (senderId || '').split('@')[0].split(':')[0];
        const botId = sock.user?.id || '';
        const botLid = sock.user?.lid || '';
        const botNumber = (botId.split(':')[0] || botId).split('@')[0];
        const botLidNumber = (botLid.split(':')[0] || botLid).split('@')[0];
        const isBotSender = Boolean(senderNumber && (senderNumber === botNumber || senderNumber === botLidNumber));
        return { isSenderAdmin: isConfiguredOwner(senderId) || isBotSender, isBotAdmin: false };
    }
}

export default isAdmin;
