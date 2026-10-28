import yts from 'yt-search';
import axios from 'axios';

const wait = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Multiple download backends - try until one works
 */
const DOWNLOADERS = [
    // 1. saverapi / similar free loaders
    async (url) => {
        const { data } = await axios.get('https://api.siputzx.my.id/api/d/ytmp3', {
            params: { url },
            timeout: 60000
        });
        const link = data?.data?.dl || data?.result?.download || data?.download || data?.url;
        const title = data?.data?.title || data?.result?.title || 'audio';
        if (!link) throw new Error('siputzx empty');
        return { downloadUrl: link, title, thumbnail: data?.data?.thumbnail || data?.result?.thumbnail };
    },
    async (url) => {
        const { data } = await axios.get('https://api.lolhuman.xyz/api/ytaudio', {
            params: { apikey: 'GataDios', url },
            timeout: 60000
        });
        const link = data?.result?.link || data?.result?.[0]?.link;
        if (!link) throw new Error('lolhuman empty');
        return { downloadUrl: link, title: data?.result?.title || 'audio', thumbnail: data?.result?.thumbnail };
    },
    async (url) => {
        const { data } = await axios.get('https://api.qasimdev.dpdns.org/api/loaderto/download', {
            params: { apiKey: 'qasim-dev', format: 'mp3', url },
            timeout: 90000
        });
        if (!data?.data?.downloadUrl) throw new Error('qasim empty');
        return data.data;
    },
    async (url) => {
        const { data } = await axios.get(`https://yt-download.org/api/button/mp3/${encodeURIComponent(url)}`, {
            timeout: 30000,
            headers: { Accept: 'application/json' }
        }).catch(() => ({ data: null }));
        // This one often returns HTML - skip if not json
        throw new Error('yt-download skip');
    }
];

async function downloadWithFallback(youtubeUrl) {
    let lastErr;
    for (let i = 0; i < DOWNLOADERS.length; i++) {
        try {
            console.log(`[play] Trying downloader ${i + 1}...`);
            const result = await DOWNLOADERS[i](youtubeUrl);
            if (result?.downloadUrl) {
                console.log(`[play] Downloader ${i + 1} success`);
                return result;
            }
        } catch (err) {
            lastErr = err;
            console.log(`[play] Downloader ${i + 1} failed: ${err.message}`);
            await wait(1000);
        }
    }
    throw lastErr || new Error('All downloaders failed');
}

export default {
    command: 'play',
    aliases: ['plays', 'music'],
    category: 'music',
    description: 'Search and download a song as MP3 from YouTube',
    usage: '.play <song name>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const query = args.join(' ').trim();

        if (!query) {
            return sock.sendMessage(chatId, {
                text: '*Which song do you want to play?*\nUsage: .play <song name>'
            }, { quoted: message });
        }

        try {
            await sock.sendMessage(chatId, {
                text: '🔍 *Searching...*'
            }, { quoted: message });

            const { videos } = await yts(query);
            if (!videos?.length) {
                return sock.sendMessage(chatId, {
                    text: '❌ *No results found!*'
                }, { quoted: message });
            }

            const video = videos[0];

            await sock.sendMessage(chatId, {
                text: `✅ *Found:* ${video.title}\n⏱️ ${video.timestamp}\n👤 ${video.author?.name || 'Unknown'}\n\n⏳ *Downloading... (may take up to 30s)*`
            }, { quoted: message });

            const songData = await downloadWithFallback(video.url);

            let thumbnailBuffer;
            try {
                const thumbUrl = songData.thumbnail || video.thumbnail;
                if (thumbUrl) {
                    const img = await axios.get(thumbUrl, { responseType: 'arraybuffer', timeout: 15000 });
                    thumbnailBuffer = Buffer.from(img.data);
                }
            } catch { /* ignore */ }

            await sock.sendMessage(chatId, {
                audio: { url: songData.downloadUrl },
                mimetype: 'audio/mpeg',
                fileName: `${(songData.title || video.title || 'song').replace(/[^\w\s-]/g, '')}.mp3`,
                contextInfo: {
                    externalAdReply: {
                        title: songData.title || video.title,
                        body: `${video.author?.name || ''} • ${video.timestamp || ''}`,
                        thumbnail: thumbnailBuffer,
                        mediaType: 2,
                        sourceUrl: video.url
                    }
                }
            }, { quoted: message });

        } catch (err) {
            console.error('Play error:', err.message);
            await sock.sendMessage(chatId, {
                text: `❌ *Failed to download.*\n\n${err.message || 'Try another song or try again later.'}\n\nTip: Use a clearer song name.`
            }, { quoted: message });
        }
    }
};
