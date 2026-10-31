import axios from 'axios';
const IMAGE_APIS = [
    (p) => `https://stable.stacktoy.workers.dev/?apikey=Suhail&prompt=${encodeURIComponent(p)}`,
    (p) => `https://dalle.stacktoy.workers.dev/?apikey=Suhail&prompt=${encodeURIComponent(p)}`,
    (p) => `https://flux.gtech-apiz.workers.dev/?apikey=Suhail&text=${encodeURIComponent(p)}`
];
const generateImage = async (prompt) => {
    for (const apiUrl of IMAGE_APIS) {
        try {
            const { data } = await axios.get(apiUrl(prompt), {
                responseType: 'arraybuffer',
                timeout: 30000,
                maxContentLength: 10 * 1024 * 1024
            });
            const buf = Buffer.from(data);
            if (buf[0] === 0x89 || buf[0] === 0xFF)
                return buf;
        }
        catch {
            continue;
        }
    }
    throw new Error('All image generation APIs failed');
};
export default {
    command: 'flux',
    aliases: ['drawflux'],
    category: 'ai',
    description: 'Generate an AI image based on your prompt',
    usage: '.flux <prompt>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const imagePrompt = args.join(' ').trim();
        if (!imagePrompt) {
            return sock.sendMessage(chatId, { text: '🎨 *AI Image Generator*\n\nUsage: `.flux <prompt>`\nExample: `.flux a beautiful sunset over mountains`' }, { quoted: message });
        }
        await sock.sendMessage(chatId, { react: { text: '🎨', key: message.key } });
        await sock.sendMessage(chatId, { text: '🎨 Generating your image... Please wait.' }, { quoted: message });
        try {
            const imageBuffer = await generateImage(imagePrompt);
            await sock.sendMessage(chatId, {
                image: imageBuffer,
                caption: `🎨 *Generated Image*\n📝 Prompt: _${imagePrompt}_`
            }, { quoted: message });
        }
        catch (error) {
            console.error('Imagine error:', error.message);
            await sock.sendMessage(chatId, { text: '❌ Failed to generate image. Please try again later.' }, { quoted: message });
        }
    }
};
