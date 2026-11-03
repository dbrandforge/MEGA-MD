import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fs.watch and fs.readdirSync to avoid side effects
vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        watch: vi.fn(),
        readdirSync: vi.fn(() => []),
        existsSync: vi.fn(() => true),
    };
});

describe('CommandHandler', () => {
    let handler;

    beforeEach(async () => {
        const mod = await import('../../lib/commandHandler.js');
        handler = mod.default;
    });

    it('exports a CommandHandler instance', () => {
        expect(handler).toBeTruthy();
        expect(typeof handler.loadCommands).toBe('function');
        expect(typeof handler.getCommand).toBe('function');
    });

    it('has empty commands map initially', () => {
        expect(handler.commands).toBeInstanceOf(Map);
    });

    it('registerCommand adds command', () => {
        handler.registerCommand({ command: 'ping', aliases: ['p'], category: 'general', description: 'test', async handler() {} });
        expect(handler.commands.has('ping')).toBe(true);
    });

    it('registerCommand registers aliases', () => {
        handler.registerCommand({ command: 'test', aliases: ['t', 'tst'], category: 'general', description: 'test', async handler() {} });
        expect(handler.aliases.has('t')).toBe(true);
        expect(handler.aliases.has('tst')).toBe(true);
    });

    it('re-registering a plugin removes its stale aliases and category', () => {
        handler.registerCommand({
            command: 'replaceprobe', aliases: ['oldprobe'], category: 'oldcategory',
            description: 'old', async handler() {}
        });
        handler.registerCommand({
            command: 'replaceprobe', aliases: ['newprobe'], category: 'newcategory',
            description: 'new', async handler() {}
        });
        expect(handler.aliases.has('oldprobe')).toBe(false);
        expect(handler.aliases.get('newprobe')).toBe('replaceprobe');
        expect(handler.categories.has('oldcategory')).toBe(false);
        expect(handler.categories.get('newcategory')).toContain('replaceprobe');
    });

    it('rejects aliases that collide with an existing command or alias', () => {
        handler.registerCommand({ command: 'primarycmd', aliases: ['sharedalias'], category: 'general', async handler() {} });
        handler.registerCommand({ command: 'secondarycmd', aliases: ['sharedalias', 'primarycmd'], category: 'general', async handler() {} });
        expect(handler.aliases.get('sharedalias')).toBe('primarycmd');
        expect(handler.aliases.has('primarycmd')).toBe(false);
        expect(handler.getCommand('.primarycmd', ['.'])?.command).toBe('primarycmd');
    });

    it('prevents a prefixless alias from shadowing a real command name', () => {
        const prefixless = {
            command: 'prefixprobe', aliases: ['realprobe'], isPrefixless: true,
            category: 'general', async handler() {}
        };
        handler.registerCommand(prefixless);
        handler.registerPrefixlessCommand(handler.commands.get('prefixprobe'));
        handler.registerCommand({
            command: 'realprobe', aliases: [], category: 'general', async handler() {}
        });
        expect(handler.prefixlessCommands.has('realprobe')).toBe(false);
        expect(handler.getCommand('realprobe', ['.'])).toBeNull();
        expect(handler.getCommand('.realprobe', ['.'])?.command).toBe('realprobe');
    });

    it('does not add a prefixless alias when its command name was registered first', () => {
        handler.registerCommand({
            command: 'realfirstprobe', aliases: [], category: 'general', async handler() {}
        });
        handler.registerCommand({
            command: 'prefixsecondprobe', aliases: ['realfirstprobe'], isPrefixless: true,
            category: 'general', async handler() {}
        });
        handler.registerPrefixlessCommand(handler.commands.get('prefixsecondprobe'));
        expect(handler.prefixlessCommands.has('realfirstprobe')).toBe(false);
    });

    it('unregisterCommand removes command, aliases, category and stats', () => {
        handler.registerCommand({
            command: 'removeprobe', aliases: ['rp'], category: 'temporary',
            description: 'test', async handler() {}
        });
        expect(handler.unregisterCommand('removeprobe')).toBe(true);
        expect(handler.commands.has('removeprobe')).toBe(false);
        expect(handler.aliases.has('rp')).toBe(false);
        expect(handler.categories.has('temporary')).toBe(false);
        expect(handler.stats.has('removeprobe')).toBe(false);
    });

    it('getCommand finds by prefix', () => {
        handler.registerCommand({ command: 'hello', aliases: [], category: 'general', description: 'test', async handler() {} });
        const result = handler.getCommand('.hello', ['.']);
        expect(result).toBeTruthy();
        expect(result.command).toBe('hello');
    });

    it('getCommand finds by alias', () => {
        handler.registerCommand({ command: 'sticker', aliases: ['s', 'stk'], category: 'media', description: 'test', async handler() {} });
        const result = handler.getCommand('.s', ['.']);
        expect(result).toBeTruthy();
    });

    it('getCommand returns null for unknown command', () => {
        const result = handler.getCommand('.unknowncmd123', ['.']);
        expect(result).toBeNull();
    });

    it('reloadCommands waits for the registry refresh and returns the loaded count', async () => {
        handler.registerCommand({ command: 'staleprobe', aliases: [], category: 'temporary', async handler() {} });
        const count = await handler.reloadCommands();
        expect(count).toBe(handler.commands.size);
        expect(count).toBeGreaterThan(200);
        expect(handler.commands.has('staleprobe')).toBe(false);
    });

    it('toggleCommand disables and re-enables', () => {
        handler.registerCommand({ command: 'mute', aliases: [], category: 'admin', description: 'test', async handler() {} });
        handler.toggleCommand('mute');
        expect(handler.disabledCommands.has('mute')).toBe(true);
        handler.toggleCommand('mute');
        expect(handler.disabledCommands.has('mute')).toBe(false);
    });

    it('getCommandsByCategory returns correct commands', () => {
        handler.registerCommand({ command: 'fun1', aliases: [], category: 'fun', description: 'test', async handler() {} });
        handler.registerCommand({ command: 'fun2', aliases: [], category: 'fun', description: 'test', async handler() {} });
        const cmds = handler.getCommandsByCategory('fun');
        expect(cmds.length).toBeGreaterThanOrEqual(2);
    });

    it('findSuggestion returns close match', () => {
        handler.registerCommand({ command: 'sticker', aliases: [], category: 'media', description: 'test', async handler() {} });
        const suggestion = handler.findSuggestion('sticke');
        expect(suggestion).toBe('sticker');
    });
});
