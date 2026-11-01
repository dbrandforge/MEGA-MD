import axios from 'axios';
import * as cheerio from 'cheerio';

const MAX_MEDIAFIRE_BYTES = 50 * 1024 * 1024;
function isMediaFireHost(hostname) {
    const host = String(hostname || '').toLowerCase();
    return host === 'mediafire.com' || host.endsWith('.mediafire.com')
        || host === 'mediafireusercontent.com' || host.endsWith('.mediafireusercontent.com');
}
function validateMediaFireUrl(value) {
    let parsed;
    try { parsed = new URL(value); } catch { return false; }
    return parsed.protocol === 'https:' && isMediaFireHost(parsed.hostname);
}
async function mediafireDl(url) {
    if (!validateMediaFireUrl(url)) throw new Error('Only valid HTTPS MediaFire links are supported.');
    try {
        const { data } = await axios.get(url, {
            timeout: 30000,
            maxContentLength: 2 * 1024 * 1024,
            maxRedirects: 5,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
            }
        });
        const $ = cheerio.load(data);
        const link = $('#downloadButton').attr('href');
        const name = $('div.dl-info > div.promo-text').text().trim() || $('.dl-btn-label').attr('title');
        const size = $('#downloadButton').text().replace(/Download|[()]|\s/g, '').trim() || 'Unknown';
        const ext = String(name || '').split('.').pop().toLowerCase();
        if (!link || !validateMediaFireUrl(link)) throw new Error('MediaFire returned an unsupported download host.');
        return { name: String(name || 'mediafire-download').replace(/[\\\\/:*?"<>|]/g, '_').slice(0, 180), size, link, ext };
    }
    catch (e) {
        return null;
    }
}
export default {
    command: 'mediafire',
    aliases: ['mfire', 'mf'],
    category: 'download',
    description: 'Download files from MediaFire',
    usage: '.mediafire <url>',
    async handler(sock, message, args, context) {
        const { chatId } = context;
        const text = args.join(' ').trim();
        if (!text)
            return await sock.sendMessage(chatId, { text: "❌ Provide a MediaFire URL.\n\nExample:\n.mfire https://www.mediafire.com/file/5e54xv2cislhfgb/twoxzhn.zip/file" }, { quoted: message });
        try {
            if (!validateMediaFireUrl(text)) {
                return await sock.sendMessage(chatId, { text: '❌ Please provide a valid HTTPS MediaFire file URL.' }, { quoted: message });
            }
            const data = await mediafireDl(text);
            if (!data || !data.link) {
                return await sock.sendMessage(chatId, { text: "❌ Failed to parse MediaFire page. Link might be private or broken." }, { quoted: message });
            }
            let caption = `≡ *MEDIAFIRE DOWNLOADER*\n\n`;
            caption += `▢ *File:* ${data.name}\n`;
            caption += `▢ *Size:* ${data.size}\n`;
            caption += `▢ *Extension:* ${data.ext}\n\n`;
            caption += `*Download In Progress... Please Wait ⌛*`;
            await sock.sendMessage(chatId, { text: caption }, { quoted: message });
            const response = await axios({
                method: 'get',
                url: data.link,
                responseType: 'arraybuffer',
                timeout: 45000,
                maxContentLength: MAX_MEDIAFIRE_BYTES,
                maxBodyLength: MAX_MEDIAFIRE_BYTES,
                maxRedirects: 5,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                    'Referer': text
                }
            });
            const finalUrl = response.request?.res?.responseUrl || data.link;
            if (!validateMediaFireUrl(finalUrl)) throw new Error('Download redirected to an unsupported host.');
            const buffer = Buffer.from(response.data);
            if (buffer.length > MAX_MEDIAFIRE_BYTES) throw new Error('File exceeds the 50 MB bot download limit.');
            if (buffer.length < 10000) {
                return await sock.sendMessage(chatId, { text: "❌ Error: The downloaded file is corrupt or invalid." });
            }
            let mimeType = 'application/octet-stream';
            const mimes = {
                'zip': 'application/zip',
                'pdf': 'application/pdf',
                'apk': 'application/vnd.android.package-archive',
                'mp4': 'video/mp4',
                'mp3': 'audio/mpeg',
                'jpg': 'image/jpeg',
                'png': 'image/png'
            };
            if (mimes[data.ext.toLowerCase()])
                mimeType = mimes[data.ext.toLowerCase()];
            await sock.sendMessage(chatId, {
                document: buffer,
                fileName: data.name,
                mimetype: mimeType,
                caption: `✅ *Download Complete:* ${data.name}`
            }, { quoted: message });
        }
        catch (err) {
            console.error('MF Download Error:', err);
            await sock.sendMessage(chatId, { text: `❌ Error: ${ err.message}` }, { quoted: message });
        }
    }
};
