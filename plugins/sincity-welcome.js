import { welcomeMessage, groupRules, introReminder } from '../data/welcomeData.js';
import store from '../lib/lightweight_store.js';

const TARGET_GROUP = '120363405434471171@g.us';
const PENDING_INTRO_KEY = 'pendingIntros';

async function getPendingIntros(chatId) {
    return (await store.getSetting(chatId, PENDING_INTRO_KEY)) || {};
}
async function savePendingIntros(chatId, data) {
    await store.saveSetting(chatId, PENDING_INTRO_KEY, data);
}

export async function handleNewMember(sock, chatId, participants) {
    if (chatId !== TARGET_GROUP) return;

    try {
        for (const user of participants) {
            const userId = typeof user === 'string' ? user : (user.id || user);
            if (!userId) continue;

            const mention = `@${userId.split('@')[0]}`;
            const welcomeText = welcomeMessage
                .replace(/@user/g, mention)
                .replace(/\{user\}/g, mention);

            await sock.sendMessage(chatId, {
                text: welcomeText,
                mentions: [userId]
            });

            // Small gap so WhatsApp doesn't drop rapid messages
            await new Promise(r => setTimeout(r, 800));

            await sock.sendMessage(chatId, { text: groupRules });

            const pending = await getPendingIntros(chatId);
            pending[userId] = { joinedAt: Date.now(), reminded: false };
            await savePendingIntros(chatId, pending);

            setTimeout(async () => {
                try {
                    const current = await getPendingIntros(chatId);
                    if (current[userId] && !current[userId].reminded) {
                        const reminder = introReminder
                            .replace(/\{user\}/g, userId.split('@')[0])
                            .replace(/@\{user\}/g, mention);
                        await sock.sendMessage(chatId, {
                            text: reminder,
                            mentions: [userId]
                        });
                        current[userId].reminded = true;
                        await savePendingIntros(chatId, current);
                    }
                } catch (e) {
                    console.error('Intro reminder error:', e.message);
                }
            }, 10 * 60 * 1000);

            // Gap between multiple joiners in one batch
            await new Promise(r => setTimeout(r, 1500));
        }
    } catch (error) {
        console.error('Welcome system error:', error);
    }
}

export async function processGroupParticipantsUpdate(sock, update) {
    try {
        if (!update?.id || !update.participants) return;
        if (update.id !== TARGET_GROUP) return;
        if (update.action !== 'add') return;

        console.log('[Welcome] Join event:', update.participants);
        // Don't block other events — run welcome without awaiting forever
        handleNewMember(sock, update.id, update.participants).catch(e =>
            console.error('Welcome async error:', e.message)
        );
    } catch (e) {
        console.error('Welcome handler error:', e.message);
    }
}

export default {
    command: 'testwelcome',
    aliases: ['tw'],
    category: 'admin',
    description: 'Test welcome on yourself',
    usage: '.testwelcome',
    adminOnly: true,
    groupOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, senderId } = context;
        if (chatId !== TARGET_GROUP) {
            return sock.sendMessage(chatId, {
                text: 'Only works in Mature minded.'
            }, { quoted: message });
        }
        await handleNewMember(sock, chatId, [senderId]);
        await sock.sendMessage(chatId, {
            text: '✅ Welcome test sent.'
        }, { quoted: message });
    }
};
