import fs from 'fs';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';
import { dataFile } from '../lib/paths.js';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { createBoundedMessageStore } from '../lib/boundedMessageStore.js';
import store from '../lib/lightweight_store.js';
const MESSAGE_STORE_MAX_ENTRIES = 10000;
const MESSAGE_STORE_TTL_MS = 48 * 60 * 60 * 1000;
const messageStore = createBoundedMessageStore({
    maxEntries: MESSAGE_STORE_MAX_ENTRIES,
    ttlMs: MESSAGE_STORE_TTL_MS,
    onEvict: entry => entry?.mediaPath ? fs.promises.unlink(entry.mediaPath).catch(() => {}) : undefined,
});
const messageStoreCleanupTimer = setInterval(() => messageStore.prune(), 5 * 60 * 1000);
messageStoreCleanupTimer.unref?.();
let cachedAntideleteConfig = null;
let cachedAntideleteConfigAt = 0;
let antideleteConfigLoadPromise = null;
const CONFIG_PATH = dataFile('antidelete.json');
const TEMP_MEDIA_DIR = path.join(process.cwd(), 'temp');
const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);
if (!fs.existsSync(TEMP_MEDIA_DIR)) {
    fs.mkdirSync(TEMP_MEDIA_DIR, { recursive: true });
}
const TEMP_MEDIA_MAX_BYTES = 150 * 1024 * 1024;
const TEMP_MEDIA_TARGET_BYTES = 100 * 1024 * 1024;
const cleanTempFolderIfLarge = () => {
    try {
        const files = fs.readdirSync(TEMP_MEDIA_DIR).map(name => {
            const filePath = path.join(TEMP_MEDIA_DIR, name);
            try {
                const stat = fs.statSync(filePath);
                return stat.isFile() ? { name, filePath, size: stat.size, mtimeMs: stat.mtimeMs } : null;
            } catch { return null; }
        }).filter(Boolean);
        let totalBytes = files.reduce((total, file) => total + file.size, 0);
        if (totalBytes <= TEMP_MEDIA_MAX_BYTES) return;
        const messageIdsByPath = new Map([...messageStore.entries()]
            .filter(([, entry]) => entry?.mediaPath)
            .map(([messageId, entry]) => [entry.mediaPath, messageId]));
        files.sort((a, b) => a.mtimeMs - b.mtimeMs);
        for (const file of files) {
            if (totalBytes <= TEMP_MEDIA_TARGET_BYTES) break;
            try {
                fs.unlinkSync(file.filePath);
                totalBytes -= file.size;
                const messageId = messageIdsByPath.get(file.filePath);
                if (messageId) messageStore.delete(messageId);
            } catch {}
        }
    } catch (err) {
        console.error('Temp cleanup error:', err);
    }
};
const tempMediaCleanupTimer = setInterval(cleanTempFolderIfLarge, 60 * 1000);
tempMediaCleanupTimer.unref?.();

async function saveMediaToFile(messageContent, mediaType, destination) {
    const stream = await downloadContentFromMessage(messageContent, mediaType);
    await pipeline(stream, createWriteStream(destination, { flags: 'w', mode: 0o600 }));
}
async function loadAntideleteConfig() {
    const now = Date.now();
    if (cachedAntideleteConfig && now - cachedAntideleteConfigAt < 5000) return { ...cachedAntideleteConfig };
    if (antideleteConfigLoadPromise) return { ...(await antideleteConfigLoadPromise) };
    antideleteConfigLoadPromise = (async () => {
        try {
            let config;
            if (HAS_DB) config = await store.getSetting('global', 'antidelete');
            else if (fs.existsSync(CONFIG_PATH)) config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
            cachedAntideleteConfig = config && typeof config === 'object' ? config : { enabled: false };
        } catch {
            cachedAntideleteConfig = { enabled: false };
        }
        cachedAntideleteConfigAt = Date.now();
        return cachedAntideleteConfig;
    })();
    try { return { ...(await antideleteConfigLoadPromise) }; }
    finally { antideleteConfigLoadPromise = null; }
}
async function saveAntideleteConfig(config) {
    try {
        if (HAS_DB) await store.saveSetting('global', 'antidelete', config);
        else fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        cachedAntideleteConfig = { ...config };
        cachedAntideleteConfigAt = Date.now();
    } catch (err) {
        cachedAntideleteConfig = null;
        cachedAntideleteConfigAt = 0;
        console.error('Config save error:', err);
    }
}
export async function storeMessage(sock, message) {
    try {
        const config = await loadAntideleteConfig();
        if (!config.enabled)
            return;
        if (!message.key?.id)
            return;
        const messageId = message.key.id;
        let content = '';
        let mediaType = '';
        let mediaPath = '';
        let isViewOnce = false;
        const sender = message.key.participant || message.key.remoteJid;
        const viewOnceContainer = message.message?.viewOnceMessageV2?.message || message.message?.viewOnceMessage?.message;
        if (viewOnceContainer) {
            if (viewOnceContainer.imageMessage) {
                mediaType = 'image';
                content = viewOnceContainer.imageMessage.caption || '';
                mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.jpg`);
                await saveMediaToFile(viewOnceContainer.imageMessage, 'image', mediaPath);
                isViewOnce = true;
            }
            else if (viewOnceContainer.videoMessage) {
                mediaType = 'video';
                content = viewOnceContainer.videoMessage.caption || '';
                mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.mp4`);
                await saveMediaToFile(viewOnceContainer.videoMessage, 'video', mediaPath);
                isViewOnce = true;
            }
        }
        else if (message.message?.conversation) {
            content = message.message.conversation;
        }
        else if (message.message?.extendedTextMessage?.text) {
            content = message.message.extendedTextMessage.text;
        }
        else if (message.message?.imageMessage) {
            mediaType = 'image';
            content = message.message.imageMessage.caption || '';
            mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.jpg`);
                await saveMediaToFile(message.message.imageMessage, 'image', mediaPath);
        }
        else if (message.message?.stickerMessage) {
            mediaType = 'sticker';
            mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.webp`);
                await saveMediaToFile(message.message.stickerMessage, 'sticker', mediaPath);
        }
        else if (message.message?.videoMessage) {
            mediaType = 'video';
            content = message.message.videoMessage.caption || '';
            mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.mp4`);
                await saveMediaToFile(message.message.videoMessage, 'video', mediaPath);
        }
        else if (message.message?.audioMessage) {
            mediaType = 'audio';
            const mime = message.message.audioMessage.mimetype || '';
            const ext = mime.includes('mpeg') ? 'mp3' : (mime.includes('ogg') ? 'ogg' : 'mp3');
            mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.${ext}`);
                await saveMediaToFile(message.message.audioMessage, 'audio', mediaPath);
        }
        messageStore.set(messageId, {
            content,
            mediaType,
            mediaPath,
            sender,
            group: message.key.remoteJid.endsWith('@g.us') ? message.key.remoteJid : null,
            timestamp: new Date().toISOString()
        });
        if (isViewOnce && mediaType && fs.existsSync(mediaPath)) {
            try {
                const ownerNumber = `${sock.user.id.split(':')[0] }@s.whatsapp.net`;
                const senderName = sender.split('@')[0];
                const mediaOptions = {
                    caption: `*Anti-ViewOnce ${mediaType}*\nFrom: @${senderName}`,
                    mentions: [sender]
                };
                if (mediaType === 'image') {
                    await sock.sendMessage(ownerNumber, { image: { url: mediaPath }, ...mediaOptions });
                }
                else if (mediaType === 'video') {
                    await sock.sendMessage(ownerNumber, { video: { url: mediaPath }, ...mediaOptions });
                }
                try {
                    fs.unlinkSync(mediaPath);
                }
                catch { }
            }
            catch (e) { }
        }
    }
    catch (err) {
        if (mediaPath) fs.promises.unlink(mediaPath).catch(() => {});
        console.error('storeMessage error:', err);
    }
}
export async function handleMessageRevocation(sock, revocationMessage) {
    try {
        const config = await loadAntideleteConfig();
        if (!config.enabled)
            return;
        const messageId = revocationMessage.message.protocolMessage.key.id;
        const deletedBy = revocationMessage.participant || revocationMessage.key.participant || revocationMessage.key.remoteJid;
        const ownerNumber = `${sock.user.id.split(':')[0] }@s.whatsapp.net`;
        if (deletedBy.includes(sock.user.id) || deletedBy === ownerNumber)
            return;
        const original = messageStore.get(messageId);
        if (!original)
            return;
        const sender = original.sender;
        const senderName = sender.split('@')[0];
        const groupName = original.group ? (await sock.groupMetadata(original.group)).subject : '';
        const time = new Date().toLocaleString('en-US', {
            timeZone: process.env.TIMEZONE || 'Asia/Karachi',
            hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit',
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
        let text = `*🔰 ANTIDELETE REPORT 🔰*\n\n` +
            `*🗑️ Deleted By:* @${deletedBy.split('@')[0]}\n` +
            `*👤 Sender:* @${senderName}\n` +
            `*📱 Number:* ${sender}\n` +
            `*🕒 Time:* ${time}\n`;
        if (groupName)
            text += `*👥 Group:* ${groupName}\n`;
        if (original.content) {
            text += `\n*💬 Deleted Message:*\n${original.content}`;
        }
        await sock.sendMessage(ownerNumber, {
            text,
            mentions: [deletedBy, sender]
        });
        if (original.mediaType && fs.existsSync(original.mediaPath)) {
            const mediaOptions = {
                caption: `*Deleted ${original.mediaType}*\nFrom: @${senderName}`,
                mentions: [sender]
            };
            try {
                switch (original.mediaType) {
                    case 'image':
                        await sock.sendMessage(ownerNumber, {
                            image: { url: original.mediaPath },
                            ...mediaOptions
                        });
                        break;
                    case 'sticker':
                        await sock.sendMessage(ownerNumber, {
                            sticker: { url: original.mediaPath },
                            ...mediaOptions
                        });
                        break;
                    case 'video':
                        await sock.sendMessage(ownerNumber, {
                            video: { url: original.mediaPath },
                            ...mediaOptions
                        });
                        break;
                    case 'audio':
                        await sock.sendMessage(ownerNumber, {
                            audio: { url: original.mediaPath },
                            mimetype: 'audio/mpeg',
                            ptt: false,
                            ...mediaOptions
                        });
                        break;
                }
            }
            catch (err) {
                await sock.sendMessage(ownerNumber, {
                    text: `⚠️ Error sending media: ${err.message}`
                });
            }
            try {
                fs.unlinkSync(original.mediaPath);
            }
            catch (err) {
                console.error('Media cleanup error:', err);
            }
        }
        messageStore.delete(messageId);
    }
    catch (err) {
        console.error('handleMessageRevocation error:', err);
    }
}
export default {
    command: 'antidelete',
    aliases: ['antidel', 'adel'],
    category: 'owner',
    description: 'Enable or disable antidelete feature to track deleted messages',
    usage: '.antidelete <on|off>',
    ownerOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const config = await loadAntideleteConfig();
        const action = args[0]?.toLowerCase();
        if (!action) {
            await sock.sendMessage(chatId, {
                text: `*🔰 ANTIDELETE SETUP 🔰*\n\n` +
                    `*Current Status:* ${config.enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
                    `*Storage:* ${HAS_DB ? 'Database' : 'File System'}\n\n` +
                    `*Commands:*\n` +
                    `• \`.antidelete on\` - Enable\n` +
                    `• \`.antidelete off\` - Disable\n\n` +
                    `*Features:*\n` +
                    `• Track deleted messages\n` +
                    `• Save deleted media\n` +
                    `• Auto-save ViewOnce media\n` +
                    `• Send reports to owner`
            }, { quoted: message });
            return;
        }
        if (action === 'on') {
            config.enabled = true;
            await saveAntideleteConfig(config);
            await sock.sendMessage(chatId, {
                text: `✅ *Antidelete enabled!*\n\n` +
                    `Storage: ${HAS_DB ? 'Database' : 'File System'}\n\n` +
                    `The bot will now:\n` +
                    `• Track all messages\n` +
                    `• Monitor deleted messages\n` +
                    `• Save ViewOnce media\n` +
                    `• Send deletion reports to owner`
            }, { quoted: message });
        }
        else if (action === 'off') {
            config.enabled = false;
            await saveAntideleteConfig(config);
            await sock.sendMessage(chatId, {
                text: `❌ *Antidelete disabled!*\n\n` +
                    `The bot will no longer track deleted messages.`
            }, { quoted: message });
        }
        else {
            await sock.sendMessage(chatId, {
                text: '❌ *Invalid command*\n\nUse: `.antidelete on/off`'
            }, { quoted: message });
        }
    },
    handleMessageRevocation,
    storeMessage,
    loadAntideleteConfig,
    saveAntideleteConfig
};
