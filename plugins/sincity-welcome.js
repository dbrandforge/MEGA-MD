import { welcomeMessage, groupRules, introReminder } from '../data/welcomeData.js';
import { dailyActivities } from '../data/dailyActivities.js';
import store from '../lib/lightweight_store.js';
import { logWelcome } from './welcomelog.js';
import { memberLeftMessages, memberRemovedMessages, memberLeftReturnMessages, memberRemovedReturnMessages, pickRotatingMessage, classifyDeparture } from '../data/groupLifecycleMessages.js';

const TARGET_GROUP = '120363405434471171@g.us';
const PENDING_INTRO_KEY = 'pendingIntros';
const DEPARTURE_INDEX_KEY = 'groupDepartureMessageIndexes';\nconst MEMBER_HISTORY_KEY = 'groupMemberHistory';\nconst RETURN_INDEX_KEY = 'groupReturnMessageIndexes';

function getLagosDay() {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const str = new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' });
    return days[new Date(str).getDay()];
}

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

            const history = (await store.getSetting(chatId, MEMBER_HISTORY_KEY)) || {};
            const prior = history[userId] || history[userId.split('@')[0]];
            const returningType = prior?.everJoined
                ? (prior.lastDeparture === 'removed' ? 'removed' : 'left')
                : null;
            const mention = `@${userId.split('@')[0]}`;

            if (returningType) {
                const bank = returningType === 'removed' ? memberRemovedReturnMessages : memberLeftReturnMessages;
                const indexes = (await store.getSetting(chatId, RETURN_INDEX_KEY)) || {};
                const selected = pickRotatingMessage(bank, indexes[returningType] ?? -1);
                indexes[returningType] = selected.index;
                await store.saveSetting(chatId, RETURN_INDEX_KEY, indexes);
                await sock.sendMessage(chatId, { text: selected.text.replaceAll('{name}', mention), mentions: [userId] });
                history[userId] = { ...prior, everJoined: true, status: 'active', lastJoinedAt: Date.now() };
                await store.saveSetting(chatId, MEMBER_HISTORY_KEY, history);
                // Returning members are not new and never re-enter pending introductions.
                continue;
            }

            const welcomeText = welcomeMessage
                .replace(/@user/g, mention)
                .replace(/\\{user\\}/g, mention);

            await sock.sendMessage(chatId, { text: welcomeText, mentions: [userId] });
            await new Promise(r => setTimeout(r, 1000));
            await sock.sendMessage(chatId, { text: groupRules });
            await new Promise(r => setTimeout(r, 1000));

            try {
                const day = getLagosDay();
                const activity = dailyActivities[day];
                if (activity?.full) {
                    await sock.sendMessage(chatId, { text: `📅 *Today's activity*\\n\\n${activity.full}` });
                }
            } catch (e) {
                console.error('Activity send error:', e.message);
            }

            await logWelcome(chatId, userId).catch(() => {});

            const pending = await getPendingIntros(chatId);
            pending[userId] = { joinedAt: Date.now(), reminded: false, introduced: false };
            await savePendingIntros(chatId, pending);
            history[userId] = { everJoined: true, status: 'active', firstJoinedAt: Date.now(), lastJoinedAt: Date.now() };
            await store.saveSetting(chatId, MEMBER_HISTORY_KEY, history);

            setTimeout(async () => {
                try {
                    const current = await getPendingIntros(chatId);
                    if (current[userId] && !current[userId].reminded) {
                        const reminder = introReminder
                            .replace(/\{user\}/g, userId.split('@')[0])
                            .replace(/@\{user\}/g, mention);
                        await sock.sendMessage(chatId, { text: reminder, mentions: [userId] });
                        current[userId].reminded = true;
                        await savePendingIntros(chatId, current);
                    }
                } catch (e) {
                    console.error('Intro reminder error:', e.message);
                }
            }, 10 * 60 * 1000);

            await new Promise(r => setTimeout(r, 1500));
        }
    } catch (error) {
        console.error('Welcome system error:', error);
    }
}


async function handleMemberDeparture(sock, chatId, update) {
    if (chatId !== TARGET_GROUP) return;
    for (const participant of update.participants || []) {
        const userId = typeof participant === 'string' ? participant : participant?.id;
        if (!userId) continue;
        const departureType = classifyDeparture(update, userId);
        const history = (await store.getSetting(chatId, MEMBER_HISTORY_KEY)) || {};
        const prior = history[userId] || history[userId.split('@')[0]] || { everJoined: true };
        history[userId] = { ...prior, everJoined: true, status: 'inactive', lastDeparture: departureType, departedAt: Date.now() };
        await store.saveSetting(chatId, MEMBER_HISTORY_KEY, history);
        const pending = await getPendingIntros(chatId);
        delete pending[userId];
        await savePendingIntros(chatId, pending);
        if (departureType === 'unknown') {
            console.warn('[Welcome] Departure actor missing; skipping unverified leave/kick announcement.');
            continue;
        }

        const mention = `@${userId.split('@')[0]}`;
        const templateBank = departureType === 'left' ? memberLeftMessages : memberRemovedMessages;
        const indexes = (await store.getSetting(chatId, DEPARTURE_INDEX_KEY)) || {};
        const key = departureType;
        const selected = pickRotatingMessage(templateBank, indexes[key] ?? -1);
        indexes[key] = selected.index;
        await store.saveSetting(chatId, DEPARTURE_INDEX_KEY, indexes);
        const text = selected.text.replaceAll('{name}', mention);
        await sock.sendMessage(chatId, { text, mentions: [userId] });
        console.log(`[Welcome] ${departureType} announcement sent for ${userId}`);
    }
}

export async function markMemberIntroduced(chatId, userId) {
    if (chatId !== TARGET_GROUP || !userId) return false;
    const pending = await getPendingIntros(chatId);
    if (!pending[userId]) return false;
    delete pending[userId];
    await savePendingIntros(chatId, pending);
    return true;
}

export async function processGroupParticipantsUpdate(sock, update) {
    try {
        if (!update?.id || !update.participants) return;
        if (update.id !== TARGET_GROUP) return;
        if (update.action === 'add') {
            console.log('[Welcome] Join event:', update.participants);
            handleNewMember(sock, update.id, update.participants).catch(e =>
                console.error('Welcome async error:', e.message)
            );
            return;
        }
        if (update.action === 'remove') {
            handleMemberDeparture(sock, update.id, update).catch(e =>
                console.error('Departure announcement error:', e.message)
            );
        }
    } catch (e) {
        console.error('Welcome handler error:', e.message);
    }
}

export default {
    command: 'testwelcome',
    aliases: ['tw'],
    category: 'admin',
    description: 'Test full welcome',
    usage: '.testwelcome',
    adminOnly: true,
    groupOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, senderId } = context;
        if (chatId !== TARGET_GROUP) {
            return sock.sendMessage(chatId, { text: 'Only works in Mature minded.' }, { quoted: message });
        }
        await handleNewMember(sock, chatId, [senderId]);
        await sock.sendMessage(chatId, {
            text: '✅ Full welcome test sent (intro + rules + activity).'
        }, { quoted: message });
    }
};
