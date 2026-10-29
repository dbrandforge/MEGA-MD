import axios from 'axios';

async function downloadIG(url) {
    const sources = [
        async () => {
            const { data } = await axios.get('https://api.siputzx.my.id/api/d/igdl', {
                params: { url }, timeout: 45000
            });
            const media = data?.data?.[0]?.url || data?.result?.[0]?.url || data?.data?.url;
            if (!media) throw new Error('siputzx empty');
            return { url: media, type: media.includes('.mp4') ? 'video' : 'image' };
        },
        async () => {
            const { data } = await axios.get('https://api.lolhuman.xyz/api/instagram', {
                params: { apikey: 'GataDios', url }, timeout: 45000
            });
            const media = data?.result?.[0] || data?.result;
            if (!media) throw new Error('lolhuman empty');
            return { url: media, type: String(media).includes('.mp4') ? 'video' : 'image' };
        },
        async () => {
            const { data } = await axios.get('https://api.akuari.my.id/downloader/igdl2', {
                params: { link: url }, timeout: 45000
            });
            const media = data?.respon?.[0]?.url || data?.result?.[0]?.url;
            if (!media) throw new Error('akuari empty');
            return { url: media, type: String(media).includes('.mp4') ? 'video' : 'image' };
        }
    ];
    let last;
    for (const s of sources) {
        try { return await s(); } catch (e) { last = e; }
    }
    throw last || new Error('All IG sources failed');
}

export default {
    command: 'ig',
    aliases: ['instagram', 'igdl'],
    category: 'downloader',
    description: 'Download Instagram post/reel',
    usage: '.ig <url>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const url = args.join(' ').trim();
        if (!url || !(url.includes('instagram') || url.includes('instagr.am'))) {
            return sock.sendMessage(chatId, {
                text: 'Send Instagram link:\n.ig https://...'
            }, { quoted: message });
        }
        try {
            await sock.sendMessage(chatId, { text: '⏳ Downloading Instagram...' }, { quoted: message });
            const res = await downloadIG(url);
            if (res.type === 'video') {
                await sock.sendMessage(chatId, { video: { url: res.url }, caption: 'Instagram' }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, { image: { url: res.url }, caption: 'Instagram' }, { quoted: message });
            }
        } catch (e) {
            await sock.sendMessage(chatId, {
                text: `❌ Instagram download failed.\n${e.message}`
            }, { quoted: message });
        }
    }
};
