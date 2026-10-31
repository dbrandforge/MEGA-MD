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
            const isPng = buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
            const isJpeg = buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
            const isWebp = buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
            if (isPng || isJpeg || isWebp) return buf;
        }
        catch {
            continue;
        }
    }
    throw new Error('All image generation APIs failed');
};
export default {
    command: 'diffusion',
    aliases: ['drawdiffusion'],
    category: 'ai',
    description: 'Generate an AI image based on your prompt',
    usage: '.diffusion <prompt>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const imagePrompt = args.join(' ').trim();
        if (!imagePrompt) {
            return sock.sendMessage(chatId, { text: '🎨 *AI Image Generator*\n\nUsage: `.diffusion <prompt>`\nExample: `.diffusion a beautiful sunset over mountains`' }, { quoted: message });
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
