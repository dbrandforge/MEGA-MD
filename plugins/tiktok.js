import axios from 'axios';

async function downloadTikTok(url) {
    const sources = [
        async () => {
            const { data } = await axios.get('https://api.siputzx.my.id/api/d/tiktok', {
                params: { url }, timeout: 45000
            });
            const v = data?.data?.download || data?.data?.video || data?.result?.video;
            if (!v) throw new Error('siputzx empty');
            return { video: v, title: data?.data?.title || 'TikTok' };
        },
        async () => {
            const { data } = await axios.get('https://api.lolhuman.xyz/api/tiktok', {
                params: { apikey: 'GataDios', url }, timeout: 45000
            });
            const v = data?.result?.link || data?.result?.video?.[0];
            if (!v) throw new Error('lolhuman empty');
            return { video: v, title: data?.result?.title || 'TikTok' };
        },
        async () => {
            const { data } = await axios.get('https://api.akuari.my.id/downloader/tiktok', {
                params: { link: url }, timeout: 45000
            });
            const v = data?.video || data?.result?.video || data?.mp4;
            if (!v) throw new Error('akuari empty');
            return { video: v, title: data?.title || 'TikTok' };
        }
    ];

    let last;
    for (const s of sources) {
        try {
            return await s();
        } catch (e) {
            last = e;
        }
    }
    throw last || new Error('All TikTok sources failed');
}

export default {
    command: 'tiktok',
    aliases: ['tt', 'ttdl'],
    category: 'downloader',
    description: 'Download TikTok video',
    usage: '.tiktok <url>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const url = args.join(' ').trim();
        if (!url || !url.includes('tiktok')) {
            return sock.sendMessage(chatId, {
                text: 'Send TikTok link:\n.tiktok https://...'
            }, { quoted: message });
        }
        try {
            await sock.sendMessage(chatId, { text: '⏳ Downloading TikTok...' }, { quoted: message });
            const res = await downloadTikTok(url);
            await sock.sendMessage(chatId, {
                video: { url: res.video },
                caption: res.title || 'TikTok'
            }, { quoted: message });
        } catch (e) {
            await sock.sendMessage(chatId, {
                text: `❌ TikTok download failed.\n${e.message}`
            }, { quoted: message });
        }
    }
};
