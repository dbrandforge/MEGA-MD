import { join } from 'path';
import { unlinkSync, readdirSync } from 'fs';
import commandHandler from '../lib/commandHandler.js';

export default {
    command: 'delplugin',
    aliases: ['deleteplugin', 'rmplugin'],
    category: 'owner',
    description: 'Delete a plugin by name (owner only)',
    usage: '.delplugin <plugin_name>',
    strictOwnerOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        try {
            const name = String(args?.[0] || '');
            if (!name) {
                return await sock.sendMessage(chatId, {
                    text: '*🌟 Example usage:*\n.delplugin main-menu'
                }, { quoted: message });
            }
            if (!/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(name) || name.includes('..')) {
                return await sock.sendMessage(chatId, { text: '❌ Invalid plugin name.' }, { quoted: message });
            }
            const pluginDir = join(process.cwd(), 'plugins');
            const pluginFiles = readdirSync(pluginDir).filter(file => file.endsWith('.js'));
            const pluginNames = pluginFiles.map(file => file.slice(0, -3));
            if (!pluginNames.includes(name)) {
                return await sock.sendMessage(chatId, {
                    text: `🗃️ Plugin not found.\n\nAvailable plugins:\n${pluginNames.join('\n')}`
                }, { quoted: message });
            }
            unlinkSync(join(pluginDir, `${name}.js`));
            commandHandler.unregisterCommand(name);
            await sock.sendMessage(chatId, { text: `⚠️ Plugin "${name}.js" has been deleted.` }, { quoted: message });
        } catch (err) {
            console.error('rmplugin error:', err);
            await sock.sendMessage(chatId, {
                text: `❌ Failed to delete plugin: ${err.message}`
            }, { quoted: message });
        }
    }
};
