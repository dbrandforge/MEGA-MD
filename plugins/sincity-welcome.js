import { introReminder } from '../data/welcomeData.js';
import { dailyActivities } from '../data/dailyActivities.js';
import store from '../lib/lightweight_store.js';
import { hasMaturedMindedFeatures } from '../lib/groupFeatureAccess.js';
import { logWelcome } from './welcomelog.js';
import { memberLeftMessages, memberRemovedMessages, memberLeftReturnMessages, memberRemovedReturnMessages, pickRotatingMessage, classifyDeparture } from '../data/groupLifecycleMessages.js';
import { buildWelcomeBatchMessage, isMemberAlreadyActive, mergeWelcomeParticipants } from '../lib/groupWelcomeBatch.js';
import { WELCOME_PACK_SETTING, normalizeWelcomePackConfig, renderWelcomePackMessage } from '../lib/groupWelcomePack.js';

const PENDING_INTRO_KEY = 'pendingIntros_v2';
const DEPARTURE_INDEX_KEY = 'groupDepartureMessageIndexes';
const MEMBER_HISTORY_KEY = 'groupMemberHistory';
const RETURN_INDEX_KEY = 'groupReturnMessageIndexes';
const introReminderTimers = new Map();
const pendingJoinBatches = new Map();
const JOIN_EVENT_COALESCE_MS = 2500;

function queueNewMemberWelcome(sock, chatId, participants) {
    let batch = pendingJoinBatches.get(chatId);
    if (!batch) {
        batch = { sock, participants: [], timer: null };
        pendingJoinBatches.set(chatId, batch);
    }
    batch.participants = mergeWelcomeParticipants(batch.participants, participants);
    if (batch.timer) return;

    // WhatsApp may emit a large admission burst as several participant-update
    // events. Coalesce the burst so it receives one shared welcome pack.
    batch.timer = setTimeout(async () => {
        pendingJoinBatches.delete(chatId);
        try {
            await handleNewMember(batch.sock, chatId, batch.participants);
        } catch (error) {
            console.error('Welcome batch error:', error.message);
        }
    }, JOIN_EVENT_COALESCE_MS);
}

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

function scheduleGroupIntroReminder(sock, chatId) {
    if (introReminderTimers.has(chatId)) return;
    const timer = setTimeout(async () => {
        introReminderTimers.delete(chatId);
        try {
            const pending = await getPendingIntros(chatId);
            const entries = Object.entries(pending).filter(([, record]) =>
                record && record.introduced !== true && record.status !== 'inactive' && !record.reminded
            );
            if (!entries.length) return;
            const mentions = entries.map(([jid]) => jid);
            const mentionText = mentions.map(jid => `@${jid.split('@')[0]}`).join(', ');
            const reminder = introReminder.replace(/@?\{user\}/g, mentionText);
            await sock.sendMessage(chatId, { text: reminder, mentions });
            for (const [jid] of entries) {
                if (pending[jid]) pending[jid].reminded = true;
            }
            await savePendingIntros(chatId, pending);
        } catch (error) {
            console.error('Group intro reminder error:', error.message);
        }
    }, 10 * 60 * 1000);
    introReminderTimers.set(chatId, timer);
}

export async function handleNewMember(sock, chatId, participants) {
    if (!await hasMaturedMindedFeatures(chatId)) return;

    try {
        const participantIds = [...new Set((participants || [])
            .map(user => typeof user === 'string' ? user : (user?.id || user?.phoneNumber || user?.lid))
            .filter(Boolean))];
        if (!participantIds.length) return;

        const history = (await store.getSetting(chatId, MEMBER_HISTORY_KEY)) || {};
        const pending = await getPendingIntros(chatId);
        const returnIndexes = (await store.getSetting(chatId, RETURN_INDEX_KEY)) || {};
        const newMembers = [];
        const returningGroups = { left: [], removed: [], unknown: [] };
        const now = Date.now();

        for (const userId of participantIds) {
            const prior = history[userId] || history[userId.split('@')[0]];
            // Participant-update retries can repeat an already processed join. Do not
            // turn an active member into a false "welcome back" announcement.
            if (isMemberAlreadyActive(prior)) continue;
            const returningType = prior?.everJoined
                ? (prior.lastDeparture === 'removed' || prior.lastDeparture === 'left' ? prior.lastDeparture : 'unknown')
                : null;

            if (returningType) {
                returningGroups[returningType].push(userId);
                history[userId] = { ...prior, everJoined: true, status: 'active', lastJoinedAt: now };
                delete pending[userId];
                continue;
            }

            newMembers.push(userId);
            pending[userId] = { joinedAt: now, reminded: false, introduced: false };
            history[userId] = {
                everJoined: true,
                status: 'active',
                firstJoinedAt: prior?.firstJoinedAt || now,
                lastJoinedAt: now
            };
        }

        // Save the entire join batch before sending messages to avoid intro races.
        await savePendingIntros(chatId, pending);
        await store.saveSetting(chatId, MEMBER_HISTORY_KEY, history);

        for (const type of ['removed', 'left', 'unknown']) {
            const ids = returningGroups[type];
            if (!ids.length) continue;
            const bank = type === 'removed' ? memberRemovedReturnMessages
                : type === 'left' ? memberLeftReturnMessages
                    : ['Welcome back. 👋'];
            const selected = pickRotatingMessage(bank, returnIndexes[type] ?? -1);
            returnIndexes[type] = selected.index;
            const mentionText = ids.map(id => `@${id.split('@')[0]}`).join(', ');
            await sock.sendMessage(chatId, {
                text: selected.text.replaceAll('{name}', mentionText),
                mentions: ids
            });
        }
        if (Object.values(returningGroups).some(ids => ids.length)) {
            await store.saveSetting(chatId, RETURN_INDEX_KEY, returnIndexes);
        }

        if (!newMembers.length) return;

        const savedPack = await store.getSetting(chatId, WELCOME_PACK_SETTING);
        const welcomePack = normalizeWelcomePackConfig(savedPack);

        if (welcomePack.enabled) {
            const activity = dailyActivities[getLagosDay()];
            const welcomeBatch = buildWelcomeBatchMessage(newMembers, welcomePack.messages[0]);
            const thirdMessage = renderWelcomePackMessage(welcomePack.messages[2], activity?.full || '');

            // One shared, independently configurable three-message pack per join batch.
            // Disabling it does not disable member history, introduction tracking,
            // reminders, departures, returns, or other group features.
            await sock.sendMessage(chatId, welcomeBatch);
            await new Promise(resolve => setTimeout(resolve, 1000));
            await sock.sendMessage(chatId, { text: welcomePack.messages[1] });
            await new Promise(resolve => setTimeout(resolve, 1000));
            await sock.sendMessage(chatId, { text: thirdMessage });
        } else {
            console.info(`[Welcome] Three-message welcome pack is OFF for ${chatId}; member tracking remains active.`);
        }

        await Promise.all(newMembers.map(userId => logWelcome(chatId, userId).catch(() => {})));
        scheduleGroupIntroReminder(sock, chatId);
    } catch (error) {
        console.error('Welcome system error:', error);
    }
}

async function handleMemberDeparture(sock, chatId, update) {
    if (!await hasMaturedMindedFeatures(chatId)) return;
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

export function looksLikeMemberIntroduction(messageText) {
    const text = String(messageText || '').trim();
    if (text.length < 25) return false;

    const hasName = /\b(my name is|name is|name\s*[:=-]|i am|i'm)\b/i.test(text);
    const profileSignals = [
        /\b(location|based in|from|live in|reside in)\b/i,
        /\b(single|married|dating|engaged|relationship status)\b/i,
        /\b(looking for|here for|seeking)\b/i,
        /\b(work as|i work|occupation|profession|business owner|student)\b/i,
        /\b(\d{2}\s*(years? old|yrs? old)|age\s*[:=-])\b/i
    ];
    const detailCount = profileSignals.filter(pattern => pattern.test(text)).length;
    return (hasName && detailCount >= 1) || (text.length >= 45 && detailCount >= 2);
}

export async function markMemberIntroduced(chatId, userId, messageText = '') {
    if (!await hasMaturedMindedFeatures(chatId) || !userId || !looksLikeMemberIntroduction(messageText)) return false;
    const pending = await getPendingIntros(chatId);
    if (!pending[userId]) return false;
    delete pending[userId];
    await savePendingIntros(chatId, pending);
    return true;
}

export async function processGroupParticipantsUpdate(sock, update) {
    try {
        if (!update?.id || !update.participants) return;
        if (!await hasMaturedMindedFeatures(update.id)) return;
        if (update.action === 'add') {
            console.log('[Welcome] Join event:', update.participants);
            queueNewMemberWelcome(sock, update.id, update.participants);
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
        if (!await hasMaturedMindedFeatures(chatId)) {
            return sock.sendMessage(chatId, { text: 'This group has not been registered for the Forge Guard feature profile.' }, { quoted: message });
        }
        await handleNewMember(sock, chatId, [senderId]);
        await sock.sendMessage(chatId, {
            text: '✅ Full welcome test sent (intro + rules + activity).'
        }, { quoted: message });
    }
};
