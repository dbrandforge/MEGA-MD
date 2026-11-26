export default {
    command: 'tagall',
    aliases: ['everyone', 'all'],
    category: 'admin',
    description: 'Use WhatsApp native @all group mention',
    usage: '.tagall',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo } = context;
        try {
            if (!chatId?.endsWith('@g.us')) {
                return sock.sendMessage(chatId, {
                    text: 'The native @all mention only works inside a group.',
                    ...channelInfo
                }, { quoted: message });
            }
            // Baileys v7 rc14 supports mentionAll. Never enumerate member JIDs here.
            await sock.sendMessage(chatId, {
                text: '@all 🔊 *Hello everyone!*',
                mentionAll: true,
                ...channelInfo
            }, { quoted: message });
        } catch (error) {
            console.error('Error in native @all command:', error);
            await sock.sendMessage(chatId, {
                text: '❌ WhatsApp could not send the native @all mention. No individual-tag fallback was sent.',
                ...channelInfo
            }, { quoted: message });
        }
    }
};
