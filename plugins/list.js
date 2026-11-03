import config from '../config.js';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import commandHandler from '../lib/commandHandler.js';
import { isOwnerOnly } from '../lib/isOwner.js';

const PUBLIC_CATEGORIES = new Set([
    'general', 'ai', 'download', 'downloader', 'utility', 'games',
    'stickers', 'tools', 'images', 'search', 'fun', 'quotes', 'music', 'info'
]);

const INTERNAL_COMMANDS = new Set([
    'hsdone_legacy', 'toddone_legacy', 'welcomemember_legacy',
    'bindsocket_internal', 'truthcontinue'
]);

function formatTime() {
    return new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: config.timeZone || 'Africa/Lagos'
    });
}

function isInternal(plugin) {
    const name = String(plugin.command || '').toLowerCase();
    return plugin.internal === true ||
        plugin.hidden === true ||
        INTERNAL_COMMANDS.has(name) ||
        name.endsWith('_internal') ||
        name.endsWith('_legacy');
}

function getVisibleCategories(ownerView) {
    const categories = new Map();
    for (const plugin of commandHandler.commands.values()) {
        const category = String(plugin.category || 'misc').toLowerCase();
        if (isInternal(plugin)) continue;
        if (!ownerView) {
            if (!PUBLIC_CATEGORIES.has(category)) continue;
            if (plugin.ownerOnly || plugin.strictOwnerOnly || plugin.adminOnly) continue;
            if (plugin.publicMenu === false) continue;
        }
        if (!categories.has(category)) categories.set(category, []);
        categories.get(category).push(plugin.command);
    }
    for (const [category, commands] of categories) {
        categories.set(category, commands.sort((a, b) => a.localeCompare(b)));
    }
    return [...categories.entries()].sort(([a], [b]) => a.localeCompare(b));
}

let menuArtworkPromise;\nasync function getMenuArtwork() {\n    if (!menuArtworkPromise) {\n        menuArtworkPromise = sharp(readFileSync(new URL('../assets/forge-guard-menu.svg', import.meta.url)))\n            .webp({ quality: 88 })\n            .toBuffer();\n    }\n    return menuArtworkPromise;\n}\n\nfunction buildMenu(ownerView) {
    const prefix = config.prefixes?.[0] || '.';
    const categories = getVisibleCategories(ownerView);
    const lines = [
        ownerView ? '╭━━━『 *FORGE GUARD • OWNER* 』━━━⬣' : '╭━━━『 *FORGE GUARD* 』━━━⬣',
        `┃ 🤖 *Bot:* ${config.botName || 'Forge Guard'}`,
        `┃ 🔧 *Prefix:* ${(config.prefixes || ['.']).join(', ')}`,
        `┃ 💎 *Version:* ${config.version || '6.1.0'}`,
        `┃ ⏰ *Time:* ${formatTime()}`,
        `┃ 📦 *Commands:* ${categories.reduce((n, [, cmds]) => n + cmds.length, 0)}`,
        '┣━━━━━━━━━━━━━━━━━━━━'
    ];
    for (const [category, commands] of categories) {
        lines.push(`┃ ${category.toUpperCase()}`);
        for (const command of commands) lines.push(`┃  • ${prefix}${command}`);
        lines.push('┃');
    }
    lines.push('╰━━━━━━━━━━━━━━━━━━━━⬣');
    return lines.join('\n');
}

export default {
    command: 'menu',
    aliases: ['help', 'commands', 'h', 'list'],
    category: 'general',
    description: 'Show public commands. Owner: .menu owner',
    usage: '.menu [owner|command]',
    async handler(sock, message, args, context) {
        const { chatId, channelInfo, senderId } = context;
        const prefix = config.prefixes?.[0] || '.';
        const ownerView = String(args?.[0] || '').toLowerCase() === 'owner';

        if (ownerView && !message.key.fromMe && !isOwnerOnly(senderId)) {
            return sock.sendMessage(chatId, {
                text: '⛔ This menu is restricted to the bot owner.',
                ...channelInfo
            }, { quoted: message });
        }

        if (args.length && !ownerView) {
            const searchTerm = String(args[0]).toLowerCase();
            let plugin = commandHandler.commands.get(searchTerm);
            if (!plugin && commandHandler.aliases.has(searchTerm)) {
                plugin = commandHandler.commands.get(commandHandler.aliases.get(searchTerm));
            }
            if (!plugin || isInternal(plugin) ||
                (!ownerView && (
                    !PUBLIC_CATEGORIES.has(String(plugin.category || '').toLowerCase()) ||
                    plugin.ownerOnly || plugin.strictOwnerOnly || plugin.adminOnly ||
                    plugin.publicMenu === false
                ))) {
                return sock.sendMessage(chatId, {
                    text: `❌ Public command "${args[0]}" not found. Use ${prefix}menu to view available commands.`,
                    ...channelInfo
                }, { quoted: message });
            }
            const detail = [
                '╭━━━━━━━━━━━━━━⬣',
                '┃ 📌 *COMMAND INFO*',
                `┃ ⚡ *Command:* ${prefix}${plugin.command}`,
                `┃ 📝 *Description:* ${plugin.description || 'No description'}`,
                `┃ 📖 *Usage:* ${plugin.usage || prefix + plugin.command}`,
                `┃ 🏷️ *Category:* ${plugin.category || 'misc'}`,
                `┃ 🔖 *Aliases:* ${plugin.aliases?.length ? plugin.aliases.map(a => prefix + a).join(', ') : 'None'}`,
                '╰━━━━━━━━━━━━━━⬣'
            ].join('\n');
            return sock.sendMessage(chatId, { text: detail, ...channelInfo }, { quoted: message });
        }

        const menuText = buildMenu(ownerView);\n        // Artwork is a separate header message so the complete dynamic command list is never truncated by WhatsApp caption limits.\n        try {\n            const artwork = await getMenuArtwork();\n            await sock.sendMessage(chatId, {\n                image: artwork,\n                caption: ownerView ? '🛡️ *FORGE GUARD • OWNER COMMAND INDEX*' : '🛡️ *FORGE GUARD • COMMAND INDEX*',\n                ...channelInfo\n            }, { quoted: message });\n        } catch (artError) {\n            console.warn('[Menu] Forge Guard artwork unavailable; sending text menu:', artError.message);\n        }\n        return sock.sendMessage(chatId, { text: menuText, ...channelInfo }, { quoted: message });
    }
};
