import yts from 'yt-search';
import axios from 'axios';

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function tryDownloaders(youtubeUrl) {
    const attempts = [
        async () => {
            const { data } = await axios.get('https://api.siputzx.my.id/api/d/ytmp3', {
                params: { url: youtubeUrl }, timeout: 60000
            });
            const link = data?.data?.dl || data?.result?.download || data?.download || data?.url;
            if (!link) throw new Error('siputzx empty');
            return { downloadUrl: link, title: data?.data?.title || data?.result?.title || 'audio', thumbnail: data?.data?.thumbnail };
        },
        async () => {
            const { data } = await axios.get('https://api.lolhuman.xyz/api/ytaudio2', {
                params: { apikey: 'GataDios', url: youtubeUrl }, timeout: 60000
            });
            const link = data?.result?.link || data?.result?.[0]?.link;
            if (!link) throw new Error('lolhuman empty');
            return { downloadUrl: link, title: data?.result?.title || 'audio', thumbnail: data?.result?.thumbnail };
        },
        async () => {
            const { data } = await axios.get('https://api.akuari.my.id/downloader/youtube', {
                params: { link: youtubeUrl }, timeout: 60000
            });
            const link = data?.mp3 || data?.audio || data?.result?.mp3;
            if (!link) throw new Error('akuari empty');
            return { downloadUrl: link, title: data?.title || 'audio', thumbnail: data?.thumb || data?.thumbnail };
        },
        async () => {
            const { data } = await axios.get('https://api.qasimdev.dpdns.org/api/loaderto/download', {
                params: { apiKey: 'qasim-dev', format: 'mp3', url: youtubeUrl }, timeout: 90000
            });
            if (!data?.data?.downloadUrl) throw new Error('qasim empty');
            return data.data;
        }
    ];

    let lastErr;
    for (let i = 0; i < attempts.length; i++) {
        try {
            console.log(`[play] trying source ${i + 1}`);
            const r = await attempts[i]();
            if (r?.downloadUrl) return r;
        } catch (e) {
            lastErr = e;
            console.log(`[play] source ${i + 1} failed:`, e.message);
            await wait(800);
        }
    }
    throw lastErr || new Error('All music sources failed');
}

export default {
    command: 'play',
    aliases: ['plays', 'music', 'song'],
    category: 'music',
    description: 'Search and download song as MP3',
    usage: '.play <song name>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const query = args.join(' ').trim();
        if (!query) {
            return sock.sendMessage(chatId, {
                text: '*Play music*\n.play <song name>\n.music davido aye'
            }, { quoted: message });
        }

        try {
            await sock.sendMessage(chatId, { text: '🔍 Searching...' }, { quoted: message });
            const { videos } = await yts(query);
            if (!videos?.length) {
                return sock.sendMessage(chatId, { text: '❌ No results found.' }, { quoted: message });
            }
            const video = videos[0];
            await sock.sendMessage(chatId, {
                text: `✅ *${video.title}*\n⏱️ ${video.timestamp || ''}\n👤 ${video.author?.name || ''}\n\n⏳ Downloading...`
            }, { quoted: message });

            const song = await tryDownloaders(video.url);

            let thumb;
            try {
                const t = song.thumbnail || video.thumbnail;
                if (t) {
                    const img = await axios.get(t, { responseType: 'arraybuffer', timeout: 12000 });
                    thumb = Buffer.from(img.data);
                }
            } catch {}

            await sock.sendMessage(chatId, {
                audio: { url: song.downloadUrl },
                mimetype: 'audio/mpeg',
                fileName: `${(song.title || video.title || 'song').replace(/[^\w\s-]/g, '').slice(0, 60)}.mp3`,
                contextInfo: {
                    externalAdReply: {
                        title: song.title || video.title,
                        body: `${video.author?.name || ''} • ${video.timestamp || ''}`,
                        thumbnail: thumb,
                        mediaType: 2,
                        sourceUrl: video.url
                    }
                }
            }, { quoted: message });
        } catch (err) {
            console.error('Play error:', err.message);
            await sock.sendMessage(chatId, {
                text: `❌ Download failed.\n${err.message || 'Try another song name.'}`
            }, { quoted: message });
        }
    }
};
