import commandHandler from '../lib/commandHandler.js';

const UNAVAILABLE_GAME_COMMANDS = new Set(['game']);

export default {
  command: 'games',
  category: 'games',
  description: 'List all available Forge Guard games.',
  usage: '.games',
  groupOnly: true,
  async handler(sock, message, args, context) {
    const chatId = context.chatId || message.key.remoteJid;
    const prefix = context.config?.prefix || '.';
    const registered = commandHandler.getCommandsByCategory('games')
      .map(name => commandHandler.commands.get(String(name).toLowerCase()))
      .filter(plugin => plugin && plugin.command !== 'games')
      .filter(plugin => !commandHandler.disabledCommands.has(String(plugin.command).toLowerCase()))
      .sort((a, b) => a.command.localeCompare(b.command));

    const available = registered.filter(plugin => !UNAVAILABLE_GAME_COMMANDS.has(plugin.command));
    const unavailable = registered.filter(plugin => UNAVAILABLE_GAME_COMMANDS.has(plugin.command));
    const lines = [
      '🎮 *FORGE GUARD — GAMES ARCADE*',
      '',
      'Games currently registered and enabled:',
      '',
      ...available.map((plugin, index) => {
        const description = plugin.description ? ` — ${plugin.description}` : '';
        const usage = plugin.usage ? `\n   Usage: ${plugin.usage.replace(/\./g, prefix)}` : '';
        return `${index + 1}. *${prefix}${plugin.command}*${description}${usage}`;
      }),
      '',
      'Open a game command to see its modes, rules and controls.',
      'For example: .trivia · .math · .wyr'
    ];

    if (unavailable.length) {
      lines.push('', '⚠️ *TEMPORARILY UNAVAILABLE*');
      for (const plugin of unavailable) {
        lines.push(`• *${prefix}${plugin.command}* — image retrieval is currently failing; excluded from the playable list until fixed.`);
      }
    }

    if (!available.length) {
      return sock.sendMessage(chatId, { text: 'No enabled game commands are currently registered.', ...(context.channelInfo || {}) }, { quoted: message });
    }
    return sock.sendMessage(chatId, { text: lines.join('\n'), ...(context.channelInfo || {}) }, { quoted: message });
  }
};
