import { welcomeMessage, groupRules, introReminder } from '../data/welcomeData.js';
import store from '../lib/lightweight_store.js';

/**
 * Sin City / Mature Minded Welcome System
 * Only triggers for the specific group
 */

// Only this group gets the automatic welcome
const TARGET_GROUP = '120363405434471171@g.us';

const PENDING_INTRO_KEY = 'pendingIntros';

async function getPendingIntros(chatId) {
    const data = await store.getSetting(chatId, PENDING_INTRO_KEY);
    return data || {};
}

async function savePendingIntros(chatId, data) {
    await store.saveSetting(chatId, PENDING_INTRO_KEY, data);
}

export async function handleNewMember(sock, chatId, participants) {
    // Safety: only run for the target group
    if (chatId !== TARGET_GROUP) {
        console.log(`[Welcome] Skipped - not the target group: ${chatId}`);
        return;
    }

    try {
        for (const user of participants) {
            const userId = typeof user === 'string' ? user : (user.id || user);
            if (!userId) continue;

            const mention = `@${userId.split('@')[0]}`;

            // 1. Welcome message
            const welcomeText = welcomeMessage
                .replace('@user', mention)
                .replace('{user}', mention);

            await sock.sendMessage(chatId, {
                text: welcomeText,
                mentions: [userId]
            });

            await new Promise(r => setTimeout(r, 1000));

            // 2. Rules message (requires ♥ reaction)
            await sock.sendMessage(chatId, {
                text: groupRules
            });

            // Track pending introduction
            const pending = await getPendingIntros(chatId);
            pending[userId] = {
                joinedAt: Date.now(),
                reminded: false
            };
            await savePendingIntros(chatId, pending);

            // 10-minute reminder
            setTimeout(async () => {
                try {
                    const current = await getPendingIntros(chatId);
                    if (current[userId] && !current[userId].reminded) {
                        const reminder = introReminder
                            .replace('{user}', userId.split('@')[0])
                            .replace('@{user}', mention);
                        await sock.sendMessage(chatId, {
                            text: reminder,
                            mentions: [userId]
                        });
                        current[userId].reminded = true;
                        await savePendingIntros(chatId, current);
                    }
                } catch (e) {
                    console.error('Intro reminder error:', e);
                }
            }, 10 * 60 * 1000);
        }
    } catch (error) {
        console.error('Welcome system error:', error);
    }
}

export async function processGroupParticipantsUpdate(sock, update) {
    try {
        if (!update || !update.id || !update.participants) return;

        const chatId = update.id;
        const action = update.action;

        // Only process for the target group
        if (chatId !== TARGET_GROUP) return;

        if (action === 'add') {
            console.log(`[Welcome] New member(s) joined Mature minded:`, update.participants);
            await handleNewMember(sock, chatId, update.participants);
        }
    } catch (e) {
        console.error('Welcome handler error:', e);
    }
}

export default {
    command: 'testwelcome',
    aliases: ['tw'],
    category: 'admin',
    description: 'Test the Mature minded welcome message',
    usage: '.testwelcome',
    adminOnly: true,
    groupOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, senderId } = context;

        if (chatId !== TARGET_GROUP) {
            return sock.sendMessage(chatId, {
                text: 'This command only works in the Mature minded group.'
            }, { quoted: message });
        }

        await handleNewMember(sock, chatId, [senderId]);
        await sock.sendMessage(chatId, {
            text: '✅ Welcome system test sent.'
        }, { quoted: message });
    }
};
