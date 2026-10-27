import { welcomeMessage, groupRules, introReminder } from '../data/welcomeData.js';
import store from '../lib/lightweight_store.js';

/**
 * Sin City Welcome System
 * - Sends welcome + rules on join
 * - Requires ♥ reaction on rules
 * - 10-minute reminder if no introduction
 */

const PENDING_INTRO_KEY = 'pendingIntros';

async function getPendingIntros(chatId) {
    const data = await store.getSetting(chatId, PENDING_INTRO_KEY);
    return data || {};
}

async function savePendingIntros(chatId, data) {
    await store.saveSetting(chatId, PENDING_INTRO_KEY, data);
}

export async function handleNewMember(sock, chatId, participants) {
    try {
        for (const user of participants) {
            const userId = typeof user === 'string' ? user : (user.id || user);
            const mention = `@${userId.split('@')[0]}`;

            // 1. Welcome message
            const welcomeText = welcomeMessage.replace('@user', mention);
            await sock.sendMessage(chatId, {
                text: welcomeText,
                mentions: [userId]
            });

            // Small delay so messages appear in order
            await new Promise(r => setTimeout(r, 800));

            // 2. Rules message (requires ♥ reaction)
            const rulesMsg = await sock.sendMessage(chatId, {
                text: groupRules
            });

            // Track this user as pending introduction
            const pending = await getPendingIntros(chatId);
            pending[userId] = {
                joinedAt: Date.now(),
                rulesMsgId: rulesMsg.key.id,
                reminded: false
            };
            await savePendingIntros(chatId, pending);

            // Schedule 10-minute reminder
            setTimeout(async () => {
                try {
                    const current = await getPendingIntros(chatId);
                    if (current[userId] && !current[userId].reminded) {
                        const reminder = introReminder.replace('{user}', userId.split('@')[0]);
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
            }, 10 * 60 * 1000); // 10 minutes
        }
    } catch (error) {
        console.error('Welcome system error:', error);
    }
}

// Command to manually trigger welcome (for testing)
export default {
    command: 'testwelcome',
    aliases: ['tw'],
    category: 'admin',
    description: 'Test the Sin City welcome message',
    usage: '.testwelcome',
    adminOnly: true,
    groupOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, senderId } = context;
        await handleNewMember(sock, chatId, [senderId]);
        await sock.sendMessage(chatId, { text: 'Welcome system test sent.' }, { quoted: message });
    }
};
