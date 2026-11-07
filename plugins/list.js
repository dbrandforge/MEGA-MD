import config from '../config.js';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import commandHandler from '../lib/commandHandler.js';
import { isOwnerOnly } from '../lib/isOwner.js';

const PRIVATE_CATEGORIES = new Set(['admin', 'owner', 'internal', 'developer']);

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

function isPublicCommand(plugin) {
    const category = String(plugin.category || 'misc').toLowerCase();
    return !isInternal(plugin) &&
        !PRIVATE_CATEGORIES.has(category) &&
        plugin.ownerOnly !== true &&
        plugin.strictOwnerOnly !== true &&
        plugin.adminOnly !== true &&
        plugin.sudoOnly !== true &&
        plugin.creatorOnly !== true &&
        plugin.publicMenu !== false;
}

export function getVisibleCategories(ownerView = false) {
    const categories = new Map();
    for (const plugin of commandHandler.commands.values()) {
        if (isInternal(plugin) || (!ownerView && !isPublicCommand(plugin))) continue;
        const category = String(plugin.category || 'misc').toLowerCase();
        if (!categories.has(category)) categories.set(category, []);
        categories.get(category).push(plugin.command);
    }
    for (const [category, commands] of categories) {
        categories.set(category, commands.sort((a, b) => a.localeCompare(b)));
    }
    return [...categories.entries()].sort(([a], [b]) => a.localeCompare(b));
}

let menuArtworkPromise;
async function getMenuArtwork() {
    if (!menuArtworkPromise) {
        menuArtworkPromise = sharp(readFileSync(new URL('../assets/forge-guard-menu.svg', import.meta.url)))
            .webp({ quality: 88 })
            .toBuffer();
    }
    return menuArtworkPromise;
}

function buildMenu(ownerView) {
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
            if (!plugin || !isPublicCommand(plugin)) {
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

        const menuText = buildMenu(ownerView);
        try {
            const artwork = await getMenuArtwork();
            await sock.sendMessage(chatId, {
                image: artwork,
                caption: ownerView ? '🛡️ *FORGE GUARD • OWNER COMMAND INDEX*' : '🛡️ *FORGE GUARD • COMMAND INDEX*',
                ...channelInfo
            }, { quoted: message });
        } catch (artError) {
            console.warn('[Menu] Forge Guard artwork unavailable; sending text menu:', artError.message);
        }
        return sock.sendMessage(chatId, { text: menuText, ...channelInfo }, { quoted: message });
    }
};
