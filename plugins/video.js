import yts from 'yt-search';
import axios from 'axios';

async function downloadYtVideo(url) {
    const sources = [
        async () => {
            const { data } = await axios.get('https://api.siputzx.my.id/api/d/ytmp4', {
                params: { url }, timeout: 60000
            });
            const v = data?.data?.dl || data?.result?.download || data?.url;
            if (!v) throw new Error('siputzx empty');
            return { url: v, title: data?.data?.title || 'video' };
        },
        async () => {
            const { data } = await axios.get('https://api.lolhuman.xyz/api/ytvideo2', {
                params: { apikey: 'GataDios', url }, timeout: 60000
            });
            const v = data?.result?.link || data?.result?.[0]?.link;
            if (!v) throw new Error('lolhuman empty');
            return { url: v, title: data?.result?.title || 'video' };
        }
    ];
    let last;
    for (const s of sources) {
        try { return await s(); } catch (e) { last = e; }
    }
    throw last || new Error('All video sources failed');
}

export default {
    command: 'video',
    aliases: ['ytvideo', 'ytv'],
    category: 'downloader',
    description: 'Download YouTube video',
    usage: '.video <name or url>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const q = args.join(' ').trim();
        if (!q) {
            return sock.sendMessage(chatId, {
                text: '.video <song/video name> or YouTube URL'
            }, { quoted: message });
        }
        try {
            await sock.sendMessage(chatId, { text: '🔍 Getting video...' }, { quoted: message });
            let url = q;
            let title = 'YouTube';
            if (!q.includes('youtube.com') && !q.includes('youtu.be')) {
                const { videos } = await yts(q);
                if (!videos?.length) {
                    return sock.sendMessage(chatId, { text: '❌ No results.' }, { quoted: message });
                }
                url = videos[0].url;
                title = videos[0].title;
            }
            const res = await downloadYtVideo(url);
            await sock.sendMessage(chatId, {
                video: { url: res.url },
                caption: res.title || title
            }, { quoted: message });
        } catch (e) {
            await sock.sendMessage(chatId, {
                text: `❌ Video download failed.\n${e.message}`
            }, { quoted: message });
        }
    }
};
