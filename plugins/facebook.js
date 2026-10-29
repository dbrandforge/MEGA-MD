import axios from 'axios';

async function downloadFB(url) {
    const sources = [
        async () => {
            const { data } = await axios.get('https://api.siputzx.my.id/api/d/facebook', {
                params: { url }, timeout: 45000
            });
            const v = data?.data?.url || data?.result?.url || data?.data?.[0]?.url;
            if (!v) throw new Error('siputzx empty');
            return v;
        },
        async () => {
            const { data } = await axios.get('https://api.lolhuman.xyz/api/facebook', {
                params: { apikey: 'GataDios', url }, timeout: 45000
            });
            const v = data?.result || data?.result?.[0];
            if (!v) throw new Error('lolhuman empty');
            return v;
        },
        async () => {
            const { data } = await axios.get('https://api.akuari.my.id/downloader/fbdl3', {
                params: { link: url }, timeout: 45000
            });
            const v = data?.respon?.hd || data?.respon?.sd || data?.result?.hd;
            if (!v) throw new Error('akuari empty');
            return v;
        }
    ];
    let last;
    for (const s of sources) {
        try { return await s(); } catch (e) { last = e; }
    }
    throw last || new Error('All Facebook sources failed');
}

export default {
    command: 'fb',
    aliases: ['facebook', 'fbdl'],
    category: 'downloader',
    description: 'Download Facebook video',
    usage: '.fb <url>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const url = args.join(' ').trim();
        if (!url || !(url.includes('facebook') || url.includes('fb.watch'))) {
            return sock.sendMessage(chatId, {
                text: 'Send Facebook link:\n.fb https://...'
            }, { quoted: message });
        }
        try {
            await sock.sendMessage(chatId, { text: '⏳ Downloading Facebook video...' }, { quoted: message });
            const video = await downloadFB(url);
            await sock.sendMessage(chatId, {
                video: { url: video },
                caption: 'Facebook'
            }, { quoted: message });
        } catch (e) {
            await sock.sendMessage(chatId, {
                text: `❌ Facebook download failed.\n${e.message}`
            }, { quoted: message });
        }
    }
};
