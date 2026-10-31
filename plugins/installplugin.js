import axios from 'axios';
import fs from 'fs';
import path from 'path';
export default {
    command: 'addplugin',
    aliases: ['installplugin', 'install'],
    category: 'owner',
    description: 'Install a plugin from a GitHub Gist URL (owner only)',
    usage: '.addplugin <Gist URL>',
    ownerOnly: true,
    /**
     * @param {object} sock - Baileys sock
     * @param {object} message - the original message object
     * @param {Array} args - command arguments
     * @param {object} context - additional context
     */
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const text = args?.[0];
        if (!text) {
            return await sock.sendMessage(chatId, {
                text: 'Please provide a plugin URL.\nExample: .addplugin https://gist.github.com/username/gistid'
            }, { quoted: message });
        }
        const gistMatch = text.match(/(?:\/|gist\.github\.com\/)([a-fA-F0-9]+)/);
        if (!gistMatch) {
            return await sock.sendMessage(chatId, { text: '❌ Invalid plugin URL.' }, { quoted: message });
        }
        const gistId = gistMatch[1];
        const gistURL = `https://api.github.com/gists/${gistId}`;
        try {
            const response = await axios.get(gistURL, { timeout: 15000, maxContentLength: 1024 * 1024, headers: { Accept: 'application/vnd.github+json' } });
            const gistData = response.data;
            if (!gistData || !gistData.files) {
                return await sock.sendMessage(chatId, { text: '❌ No valid files found in the Gist.' }, { quoted: message });
            }
            const pluginDir = path.join(process.cwd(), 'plugins');
            const files = Object.values(gistData.files);
            if (!files.length || files.length > 5) throw new Error('A Gist must contain between 1 and 5 plugin files.');
            for (const file of files) {
                const pluginName = String(file.filename || '');
                if (!/^[a-z0-9][a-z0-9._-]{0,79}\.js$/i.test(pluginName) || pluginName.includes('..')) throw new Error('Unsafe plugin filename rejected.');
                if (file.truncated || typeof file.content !== 'string' || Buffer.byteLength(file.content, 'utf8') > 256 * 1024) throw new Error('Plugin file is missing, truncated, or exceeds 256 KB.');
                const pluginPath = path.resolve(pluginDir, pluginName);
                if (!pluginPath.startsWith(path.resolve(pluginDir) + path.sep)) throw new Error('Plugin path is outside the plugins directory.');
                await fs.promises.writeFile(pluginPath, file.content, { flag: 'wx' });
            }
            await sock.sendMessage(chatId, { text: '*✅ Successfully installed plugin from Gist.*' }, { quoted: message });
        }
        catch (error) {
            console.error('install plugin error:', error);
            await sock.sendMessage(chatId, { text: `❌ Error fetching or saving the plugin: ${error.message}` }, { quoted: message });
        }
    }
};
