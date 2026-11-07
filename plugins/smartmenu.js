import config from '../config.js';
import CommandHandler from '../lib/commandHandler.js';
const menuEmojis = ['✨', '🌟', '⭐', '💫', '🎯', '🎨', '🎪', '🎭'];
const activeEmojis = ['✅', '🟢', '💚', '✔️', '☑️'];
const disabledEmojis = ['❌', '🔴', '⛔', '🚫', '❎'];
const fastEmojis = ['⚡', '🚀', '💨', '⏱️', '🔥'];
const slowEmojis = ['🐢', '🐌', '⏳', '⌛', '🕐'];
const categoryEmojis = {
    general: ['📱', '🔧', '⚙️', '🛠️'],
    owner: ['👑', '🔱', '💎', '🎖️'],
    admin: ['🛡️', '⚔️', '🔐', '👮'],
    group: ['👥', '👫', '🧑‍🤝‍🧑', '👨‍👩‍👧‍👦'],
    download: ['📥', '⬇️', '💾', '📦'],
    ai: ['🤖', '🧠', '💭', '🎯'],
    search: ['🔍', '🔎', '🕵️', '📡'],
    apks: ['📲', '📦', '💿', '🗂️'],
    info: ['ℹ️', '📋', '📊', '📄'],
    fun: ['🎮', '🎲', '🎰', '🎪'],
    stalk: ['👀', '🔭', '🕵️', '🎯'],
    games: ['🎮', '🕹️', '🎯', '🏆'],
    images: ['🖼️', '📸', '🎨', '🌄'],
    menu: ['📜', '📋', '📑', '📚'],
    tools: ['🔨', '🔧', '⚡', '🛠️'],
    stickers: ['🎭', '😀', '🎨', '🖼️'],
    quotes: ['💬', '📖', '✍️', '💭'],
    music: ['🎵', '🎶', '🎧', '🎤'],
    utility: ['📂', '🔧', '⚙️', '🛠️']
};
function getRandomEmoji(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function getCategoryEmoji(category) {
    const emojis = categoryEmojis[category.toLowerCase()] || ['📂', '📁', '🗂️', '📋'];
    return getRandomEmoji(emojis);
}
function formatTime() {
    return new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: config.timeZone || 'Africa/Lagos'
    });
}

function getDiagnosticCategories() {
    const categories = new Map();
    for (const plugin of CommandHandler.commands.values()) {
        const category = String(plugin.category || 'misc').toLowerCase();
        if (!categories.has(category)) categories.set(category, []);
        categories.get(category).push(plugin.command);
    }
    for (const [category, commands] of categories) {
        categories.set(category, commands.sort((a, b) => a.localeCompare(b)));
    }
    return [...categories.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export default {
    command: 'smenu',
    aliases: ['shelp', 'smart', 'help2'],
    category: 'owner',
    description: 'Owner-only diagnostic menu with live command status',
    usage: '.smenu',
    strictOwnerOnly: true,
    isPrefixless: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        try {
            const categories = getDiagnosticCategories();
            const stats = CommandHandler.getDiagnostics();
            const menuEmoji = getRandomEmoji(menuEmojis);
            const activeEmoji = getRandomEmoji(activeEmojis);
            const disabledEmoji = getRandomEmoji(disabledEmojis);
            const fastEmoji = getRandomEmoji(fastEmojis);
            const slowEmoji = getRandomEmoji(slowEmojis);
            let menuText = `${menuEmoji} *${config.botName || 'Forge Guard'}* ${menuEmoji}\n\n`;
            menuText += `┏━━━━━━━━━━━━━━━━┓\n`;
            menuText += `┃ 📱 *Bot:* ${config.botName || 'MEGA-MD'}\n`;
            menuText += `┃ 🔖 *Version:* ${config.version || '6.1.0'}\n`;
            menuText += `┃ 👤 *Owner:* ${config.botOwner || 'Unknown'}\n`;
            menuText += `┃ ⏰ *Time:* ${formatTime()}\n`;
            menuText += `┃ ℹ️ *Prefix:* ${config.prefixes ? config.prefixes.join(', ') : '.'}\n`;
            menuText += `┃ 📊 *Plugins:* ${CommandHandler.commands.size}\n`;
            menuText += `┗━━━━━━━━━━━━━━━━┛\n\n`;
            const topCmds = stats.slice(0, 3).filter(s => s.usage > 0);
            if (topCmds.length > 0) {
                menuText += `🔥 *TOP COMMANDS:*\n`;
                topCmds.forEach((c, i) => {
                    const rank = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
                    menuText += `${rank} .${c.command} • ${c.usage} uses\n`;
                });
                menuText += `\n`;
            }
            for (const [cat, catCmds] of categories) {
                const catEmoji = getCategoryEmoji(cat);
                menuText += `${catEmoji} *${cat.toUpperCase()}*\n`;
                menuText += `┌─────────────────\n`;
                catCmds.forEach((cmdName, index) => {
                    const isLast = index === catCmds.length - 1;
                    const prefix = isLast ? '└' : '├';
                    const isOff = CommandHandler.disabledCommands.has(cmdName.toLowerCase());
                    const cmdStats = stats.find(s => s.command === cmdName.toLowerCase());
                    const statusIcon = isOff ? disabledEmoji : activeEmoji;
                    let speedTag = '';
                    if (cmdStats && !isOff) {
                        const ms = parseFloat(cmdStats.average_speed);
                        if (ms > 0 && ms < 100) speedTag = ` ${fastEmoji}`;
                        else if (ms > 1000) speedTag = ` ${slowEmoji}`;
                    }
                    menuText += `${prefix}─ ${statusIcon} .${cmdName}${speedTag}\n`;
                });
                menuText += `\n`;
            }
            menuText += `┌────────────────\n`;
            menuText += `├  💡 *LEGEND*\n`;
            menuText += `├─ ${activeEmoji} Active Command\n`;
            menuText += `├─ ${disabledEmoji} Disabled Command\n`;
            menuText += `├─ ${fastEmoji} Fast Response\n`;
            menuText += `├─ ${slowEmoji} Slow Response\n`;
            menuText += `⁠└────────────────`;
            await sock.sendMessage(chatId, { text: menuText }, { quoted: message });
        } catch (error) {
            console.error('Menu Error:', error);
            await sock.sendMessage(chatId, {
                text: `❌ *Menu Error*\n\n${error.message}`
            }, { quoted: message });
        }
    }
};
