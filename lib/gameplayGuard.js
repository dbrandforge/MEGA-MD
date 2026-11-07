import store from './lightweight_store.js';
import config from '../config.js';

// These checks run only when somebody explicitly tries to use the AI in a group,
// so ordinary game answers and normal group traffic do not create extra DB reads.
const GAME_KEYS = Object.freeze({
    math: 'mathGame',
    trivia: 'triviaArenaV2',
    legacyTrivia: 'triviaGame',
    hangman: 'hangmanGame',
    hotseat: 'hotseatSession',
    wyr: 'wouldYouRatherSessions',
    tod: 'todSessions',
    basket: 'devilsBasketSessions'
});

function isFresh(timestamp, windowMs, now) {
    return Number.isFinite(Number(timestamp)) && now - Number(timestamp) <= windowMs;
}

export function hasActiveGameplayState(states, now = Date.now()) {
    const math = states?.math;
    if (math?.active && (!math.matchExpiresAt || math.matchExpiresAt > now)) return true;

    const trivia = states?.trivia?.active ? states.trivia : states?.legacyTrivia;
    if (trivia?.active && (!trivia.matchExpiresAt || trivia.matchExpiresAt > now)
        && (!trivia.expiresAt || trivia.expiresAt > now)) return true;

    const hangman = states?.hangman;
    if (hangman?.status === 'active' && (!hangman.expiresAt || hangman.expiresAt > now)) return true;

    const hotseat = states?.hotseat;
    const hotseatWindow = Number(config.hotseatSessionHours || 2) * 60 * 60 * 1000;
    if (hotseat?.status === 'active' && isFresh(hotseat.startedAt, hotseatWindow, now)) return true;

    const wyrWindow = 30 * 60 * 1000;
    if (Object.values(states?.wyr || {}).some(session => session?.expiresAt > now)) return true;

    const todWindow = 10 * 60 * 1000;
    if (Object.values(states?.tod || {}).some(session => session?.status === 'active'
        && isFresh(session.lastActivity || session.lastCompletedAt || session.startedAt, todWindow, now))) return true;

    const basketWindow = 30 * 60 * 1000;
    if (Object.values(states?.basket || {}).some(session => session?.questionMessageId
        && isFresh(session.updatedAt, basketWindow, now))) return true;

    return false;
}

export async function isGroupGameplayActive(chatId, hasTicTacToe = false) {
    if (!String(chatId || '').endsWith('@g.us')) return false;
    try {
        const values = await Promise.all(Object.values(GAME_KEYS).map(key =>
            store.getSetting(chatId, key).catch(() => null)
        ));
        const states = Object.fromEntries(Object.keys(GAME_KEYS).map((key, index) => [key, values[index]]));
        return hasActiveGameplayState(states) || Boolean(hasTicTacToe);
    } catch {
        // Fail closed for AI access only: if game state cannot be read, do not
        // let an AI request become a possible answer leak during a live match.
        return true;
    }
}

export function isExplicitAIRequest({ text = '', message = {}, sock = {}, isAICommand = false } = {}) {
    if (isAICommand) return true;
    const body = String(text || '').trim();
    if (!body) return false;
    const context = message.message?.extendedTextMessage?.contextInfo
        || message.message?.imageMessage?.contextInfo
        || message.message?.videoMessage?.contextInfo
        || {};
    const botIds = [sock.user?.id, sock.user?.lid].filter(Boolean).map(value =>
        String(value).split(':')[0].split('@')[0]
    );
    const addressed = (context.mentionedJid || []).some(jid =>
        botIds.includes(String(jid || '').split(':')[0].split('@')[0])
    ) || (context.participant && botIds.includes(
        String(context.participant).split(':')[0].split('@')[0]
    )) || botIds.some(number => number && body.includes('@' + number));

    if (!addressed) return false;
    return /\?|\b(chatgpt|use ai|ask ai|answer this|help me answer|solve this|explain this|tell me about|define)\b|^(who|what|when|where|why|how|which|can you|could you|please explain|please tell)\b/i.test(body);
}

export function pickGameplayCheatReply() {
    const replies = [
        'Brooo, you want to cheat? 😂 The game is live. Use that brain you brought from home.',
        'Omo, so you want to outsource your answer? We see you. Play the game! 😭',
        'You created me, abi? Now you want me to help you steal points? Behave. 😂',
        'ChatGPT during gameplay? My friend, face your question. No external assistance! 🤣',
        'Ah ah! Is this a competition or an AI consultation? Answer by yourself, boss. 😭',
        'Nice try, professor. The answer must come from your head, not my server. 😂'
    ];
    return replies[Math.floor(Math.random() * replies.length)];
}
