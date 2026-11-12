import { getChatbotMediaModes, setChatbotMediaMode } from '../lib/chatbotMedia.js';

export default {
    command: 'voicemode',
    aliases: ['voicechat', 'voicereply'],
    category: 'admin',
    description: 'Enable or disable chatbot transcription and replies to WhatsApp voice notes in this chat.',
    usage: '.voicemode on|off|status',
    adminOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const action = String(args?.[0] || 'status').toLowerCase();
        if (!['on', 'off', 'status'].includes(action)) {
            return sock.sendMessage(chatId, { text: 'Usage: .voicemode on|off|status' }, { quoted: message });
        }
        if (action !== 'status') {
            const saved = await setChatbotMediaMode(chatId, 'voiceNotes', action === 'on');
            if (!saved) return sock.sendMessage(chatId, { text: '❌ Voice mode could not be saved. No change was confirmed.' }, { quoted: message });
        }
        const modes = await getChatbotMediaModes(chatId);
        return sock.sendMessage(chatId, {
            text: `🎙️ *VOICE NOTE CHATBOT MODE*\n\nStatus: ${modes.voiceNotes ? '🟢 ON' : '🔴 OFF'}\n\n${action === 'status' ? 'No setting changed.' : `Voice-note replies switched ${action.toUpperCase()} for this chat.`}\n\nMaximum length: 60 seconds, 2 MB. Daily caps: 3 per sender, 5 per chat, and 10 across the bot. The chatbot must also be enabled. In groups, Forge Guard only processes voice notes when directly addressed.`
        }, { quoted: message });
    }
};
