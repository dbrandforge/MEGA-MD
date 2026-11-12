import { getChatbotMediaModes, setChatbotMediaMode } from '../lib/chatbotMedia.js';

export default {
    command: 'stickermode',
    aliases: ['stickerchat'],
    category: 'admin',
    description: 'Enable or disable contextual chatbot replies to stickers in this chat.',
    usage: '.stickermode on|off|status',
    adminOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const action = String(args?.[0] || 'status').toLowerCase();
        if (!['on', 'off', 'status'].includes(action)) {
            return sock.sendMessage(chatId, { text: 'Usage: .stickermode on|off|status' }, { quoted: message });
        }
        if (action !== 'status') {
            const saved = await setChatbotMediaMode(chatId, 'stickers', action === 'on');
            if (!saved) return sock.sendMessage(chatId, { text: '❌ Sticker mode could not be saved. No change was confirmed.' }, { quoted: message });
        }
        const modes = await getChatbotMediaModes(chatId);
        return sock.sendMessage(chatId, {
            text: `🖼️ *STICKER CHATBOT MODE*\n\nStatus: ${modes.stickers ? '🟢 ON' : '🔴 OFF'}\n\n${action === 'status' ? 'No setting changed.' : `Sticker replies switched ${action.toUpperCase()} for this chat.`}\n\nDaily caps: 5 per sender, 10 per chat, and 25 across the bot. The chatbot must also be enabled. In groups, Forge Guard only processes stickers when directly addressed.`
        }, { quoted: message });
    }
};
