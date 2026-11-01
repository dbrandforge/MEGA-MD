/**
 * Solo .truth / .dare session continuity.
 *
 * Problem this fixes: once chatbot auto-reply was turned on, a user who
 * answered their truth/dare by just tagging the bot (instead of literally
 * swipe-replying to the bot's message) got the chatbot's own sarcastic
 * reply instead of the next truth/dare - because the old version of this
 * file only ever looked at whether the incoming message *quoted* a
 * message containing the TRUTH/DARE marker, with no real session state.
 *
 * Now: starting .truth or .dare opens a real session for that user in
 * that chat. While it's open, ANY message from that user that either (a)
 * quotes the bot's last truth/dare message, or (b) tags/mentions the bot,
 * is treated as "I'm ready for the next one" and advances the game -
 * skipping the chatbot entirely. The session stays open until the user
 * types stop/end, or a group admin clears it, regardless of how many
 * truths/dares have been sent in between.
 */
import store from '../lib/lightweight_store.js';
import { getTruths, getDares, randomFrom } from '../data/todLists.js';
import { getUserGender } from './gender.js';
import isAdmin from '../lib/isAdmin.js';

const TRUTH_MARKER = '🔥 *TRUTH*';
const DARE_MARKER = '🔥 *DARE*';
const SESSIONS_KEY = 'soloTruthDareSessions';

async function getSessions(chatId) {
    return (await store.getSetting(chatId, SESSIONS_KEY)) || {};
}

async function saveSessions(chatId, sessions) {
    await store.saveSetting(chatId, SESSIONS_KEY, sessions);
}

// Called by plugins/truth.js and plugins/dare.js right after they send the
// first prompt, so continuity has something to track.
export async function startSoloSession(chatId, senderId, type, gender) {
    const sessions = await getSessions(chatId);
    sessions[senderId] = { type, gender, startedAt: Date.now(), lastActivity: Date.now(), questionMessageId: null, questionsAnswered: 0 };
    await saveSessions(chatId, sessions);
}

export async function setSoloQuestionMessage(chatId, senderId, messageId) {
    if (!messageId) return;
    const sessions = await getSessions(chatId);
    const session = sessions[senderId];
    if (!session) return;
    session.questionMessageId = messageId;
    session.lastActivity = Date.now();
    sessions[senderId] = session;
    await saveSessions(chatId, sessions);
}

export async function endSoloSession(chatId, senderId) {
    const sessions = await getSessions(chatId);
    if (sessions[senderId]) {
        delete sessions[senderId];
        await saveSessions(chatId, sessions);
        return true;
    }
    return false;
}

function isBotMentioned(sock, message, userMessage) {
    const botId = sock.user?.id || '';
    const botNumber = botId.split(':')[0].split('@')[0];
    const botLid = sock.user?.lid || '';
    const botJids = [botId, `${botNumber}@s.whatsapp.net`, botLid].filter(Boolean);

    const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const byMentionedJid = mentioned.some(j =>
        botJids.some(b => b.split('@')[0].split(':')[0] === j.split('@')[0].split(':')[0])
    );
    const byAtNumber = botNumber && (userMessage || '').includes(`@${botNumber}`);
    return byMentionedJid || byAtNumber;
}

function quotesTruthOrDare(message) {
    const contextInfo = message.message?.extendedTextMessage?.contextInfo ||
        message.message?.imageMessage?.contextInfo ||
        message.message?.videoMessage?.contextInfo;
    const quotedText = contextInfo?.quotedMessage?.conversation ||
        contextInfo?.quotedMessage?.extendedTextMessage?.text || '';
    if (quotedText.includes(TRUTH_MARKER)) return 'truth';
    if (quotedText.includes(DARE_MARKER)) return 'dare';
    return null;
}

async function sendNext(sock, chatId, senderId, session, sessions) {
    const list = session.type === 'truth' ? getTruths(session.gender) : getDares(session.gender);
    const content = randomFrom(list);
    const label = session.type === 'truth' ? '🔥 *TRUTH*' : '🔥 *DARE*';

    session.lastActivity = Date.now();
    session.questionsAnswered = (session.questionsAnswered || 0) + 1;
    sessions[senderId] = session;
    await saveSessions(chatId, sessions);

    const sent = await sock.sendMessage(chatId, {
        text: `${label} (${session.gender}) 🔥\n\n${content}\n\n_Reply to this message or tag me to get another one. Type *stop* to end._`,
        mentions: [senderId]
    });
    session.questionMessageId = sent?.key?.id || null;
    sessions[senderId] = session;
    await saveSessions(chatId, sessions);
}

/**
 * Call this from messageHandler for every group message. Returns true if
 * it handled the message (caller should stop processing further).
 */
export async function handleTruthDareContinue(sock, chatId, message, userMessage, senderId) {
    try {
        const lower = (userMessage || '').trim().toLowerCase();
        const sessions = await getSessions(chatId);
        const session = senderId ? sessions[senderId] : null;

        // Stop/end: the session owner can always end their own session.
        if (session && (lower === 'stop' || lower === 'end' || lower === '.stop')) {
            if (!(session.questionsAnswered > 0)) {
                await sock.sendMessage(chatId, { text: 'Reply to or tag the bot on your current Truth/Dare prompt first. You can end your session after attempting at least one prompt.' }, { quoted: message });
                return true;
            }
            delete sessions[senderId];
            await saveSessions(chatId, sessions);
            await sock.sendMessage(chatId, {
                text: '✅ Stopped. Use *.truth* or *.dare* anytime to start again.'
            }, { quoted: message });
            return true;
        }

        // Admin override: ".stopgame" clears every active solo session in
        // this chat, regardless of whose it is.
        if ((lower === '.stopgame' || lower === '.endgame') && Object.keys(sessions).length) {
            const { isSenderAdmin } = await isAdmin(sock, chatId, senderId);
            if (isSenderAdmin) {
                await saveSessions(chatId, {});
                await sock.sendMessage(chatId, {
                    text: '🛑 Admin ended all active Truth/Dare sessions in this group.'
                }, { quoted: message });
                return true;
            }
        }

        if (!session) return false;

        // Advance only when this user replies to their exact active prompt,
        // or explicitly mentions the bot. Unrelated messages and old prompt
        // replies must never advance the session.
        const contextInfo = message.message?.extendedTextMessage?.contextInfo ||
            message.message?.imageMessage?.contextInfo ||
            message.message?.videoMessage?.contextInfo;
        const stanzaId = contextInfo?.stanzaId || null;
        const repliedToCurrentPrompt = !!(stanzaId && session.questionMessageId && stanzaId === session.questionMessageId);
        const mentioned = isBotMentioned(sock, message, userMessage);
        if (!repliedToCurrentPrompt && !mentioned) return false;

        await sendNext(sock, chatId, senderId, session, sessions);
        return true;
    } catch (e) {
        console.error('Truth/Dare continue error:', e);
        return false;
    }
}

export default {
    command: 'truthcontinue',
    category: 'games',
    description: 'Internal continuity helper',
    // No public handler needed
    async handler() {}
};
