import { introReminder } from '../data/welcomeData.js';
import { dailyActivities } from '../data/dailyActivities.js';
import store from '../lib/lightweight_store.js';
import { hasMaturedMindedFeatures } from '../lib/groupFeatureAccess.js';
import { logWelcome } from './welcomelog.js';
import { memberLeftMessages, memberRemovedMessages, memberLeftReturnMessages, memberRemovedReturnMessages, pickRotatingMessage, classifyDeparture } from '../data/groupLifecycleMessages.js';
import { buildWelcomeBatchMessage, isMemberAlreadyActive, mergeWelcomeParticipants, createOrExtendWelcomeBatch, getEligibleIntroReminderEntries, getNextIntroReminderAt, createWelcomeCampaign, isWelcomeCampaignActive, buildWelcomeCampaignMessage, getPendingIntroductionEntries, chunkPendingIntroductionEntries, buildPendingIntroductionReminder, formatPendingIntroductionList } from '../lib/groupWelcomeBatch.js';
import { WELCOME_PACK_SETTING, normalizeWelcomePackConfig, renderWelcomePackMessage } from '../lib/groupWelcomePack.js';

const PENDING_INTRO_KEY = 'pendingIntros_v2';
const DEPARTURE_INDEX_KEY = 'groupDepartureMessageIndexes';
const MEMBER_HISTORY_KEY = 'groupMemberHistory';
const RETURN_INDEX_KEY = 'groupReturnMessageIndexes';
const introReminderTimers = new Map();
const pendingJoinBatches = new Map();
const JOIN_BATCH_KEY = 'pendingWelcomeJoinBatch_v1';
const JOIN_BATCH_INDEX_KEY = 'pendingWelcomeJoinBatchGroups_v1';
const WELCOME_CAMPAIGN_KEY = 'welcomeCampaign_v1';
const WELCOME_CAMPAIGN_INDEX_KEY = 'welcomeCampaignGroups_v1';
const JOIN_BATCH_WINDOW_MS = 3 * 60 * 1000;
const INTRO_REMINDER_DELAY_MS = 10 * 60 * 1000;

async function saveJoinBatchIndex(chatId, add) {
    const current = await store.getSetting('global', JOIN_BATCH_INDEX_KEY);
    const groups = new Set(Array.isArray(current) ? current : []);
    if (add) groups.add(chatId); else groups.delete(chatId);
    if (!await store.saveSettingVerified('global', JOIN_BATCH_INDEX_KEY, [...groups])) {
        throw new Error('Pending welcome batch index could not be persisted.');
    }
}

function scheduleJoinBatchFlush(sock, chatId, batch) {
    const existing = pendingJoinBatches.get(chatId);
    if (existing?.timer) clearTimeout(existing.timer);
    const timer = setTimeout(async () => {
        try {
            const persisted = await store.getSetting(chatId, JOIN_BATCH_KEY);
            if (!persisted || persisted.batchId !== batch.batchId) return;
            await handleNewMember(sock, chatId, persisted.participants || []);
            if (!await store.saveSettingVerified(chatId, JOIN_BATCH_KEY, null)) {
                throw new Error('Pending welcome batch could not be cleared.');
            }
            await saveJoinBatchIndex(chatId, false);
            pendingJoinBatches.delete(chatId);
        } catch (error) {
            console.error('Welcome batch flush error:', error.message);
            // Keep the durable batch and retry rather than silently dropping arrivals.
            const retry = { ...batch, flushAt: Date.now() + 30_000 };
            try {
                await store.saveSettingVerified(chatId, JOIN_BATCH_KEY, retry);
                scheduleJoinBatchFlush(sock, chatId, retry);
            } catch (retryError) {
                console.error('Welcome batch retry could not be scheduled:', retryError.message);
            }
        }
    }, Math.max(0, Number(batch.flushAt) - Date.now()));
    pendingJoinBatches.set(chatId, { ...batch, timer });
}

async function queueNewMemberWelcome(sock, chatId, participants) {
    const now = Date.now();
    const saved = await store.getSetting(chatId, JOIN_BATCH_KEY);
    const batch = createOrExtendWelcomeBatch(
        saved,
        participants,
        now,
        JOIN_BATCH_WINDOW_MS,
        `${now}-${Math.random().toString(36).slice(2, 8)}`
    );
    if (!await store.saveSettingVerified(chatId, JOIN_BATCH_KEY, batch)) {
        throw new Error('Pending welcome batch could not be persisted.');
    }
    await saveJoinBatchIndex(chatId, true);
    scheduleJoinBatchFlush(sock, chatId, batch);
}

export async function restoreWelcomeJobs(sock) {
    const indexed = await store.getSetting('global', JOIN_BATCH_INDEX_KEY);
    const tracked = await store.getSetting('global', 'forgeGuardTrackedGroups');
    const campaignGroups = await store.getSetting('global', WELCOME_CAMPAIGN_INDEX_KEY);
    const groups = new Set([
        ...(Array.isArray(indexed) ? indexed : []),
        ...(Array.isArray(tracked) ? tracked : []),
        ...(Array.isArray(campaignGroups) ? campaignGroups : [])
    ]);
    for (const chatId of groups) {
        if (!chatId?.endsWith('@g.us')) continue;
        const batch = await store.getSetting(chatId, JOIN_BATCH_KEY);
        if (batch?.flushAt && Array.isArray(batch.participants) && batch.participants.length) {
            scheduleJoinBatchFlush(sock, chatId, batch);
        }
        scheduleGroupIntroReminder(sock, chatId);
    }
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

export async function getPendingIntroductionList(chatId) {
    if (!await hasMaturedMindedFeatures(chatId)) return [];
    const pending = await getPendingIntros(chatId);
    return getPendingIntroductionEntries(pending);
}
export async function sendPendingIntroductionReminder(sock, chatId) {
    if (!await hasMaturedMindedFeatures(chatId)) return { sent: false, reason: 'not-configured', count: 0, batches: 0 };
    const entries = await getPendingIntroductionList(chatId);
    if (!entries.length) return { sent: true, count: 0, batches: 0 };
    const batches = chunkPendingIntroductionEntries(entries, 40);
    for (let index = 0; index < batches.length; index++) {
        await sock.sendMessage(chatId, buildPendingIntroductionReminder(batches[index], index + 1, batches.length));
        if (index < batches.length - 1) await new Promise(resolve => setTimeout(resolve, 900));
    }
    return { sent: true, count: entries.length, batches: batches.length };
}
export function buildPendingIntroductionListMessages(entries, chunkSize = 40) {
    const batches = chunkPendingIntroductionEntries(entries, chunkSize);
    return batches.map((batch, index) => formatPendingIntroductionList(batch, index + 1, batches.length));
}
async function addWelcomeCampaignGroup(chatId) {
    const current = await store.getSetting('global', WELCOME_CAMPAIGN_INDEX_KEY);
    const groups = new Set(Array.isArray(current) ? current : []);
    groups.add(chatId);
    if (!await store.saveSettingVerified('global', WELCOME_CAMPAIGN_INDEX_KEY, [...groups])) {
        throw new Error('Welcome campaign recovery index could not be persisted.');
    }
}

export async function startWelcomeCampaign(sock, chatId) {
    if (!await hasMaturedMindedFeatures(chatId)) {
        return { started: false, reason: 'not-configured' };
    }

    const now = Date.now();
    const existing = await store.getSetting(chatId, WELCOME_CAMPAIGN_KEY);
    if (isWelcomeCampaignActive(existing, now)) {
        return {
            started: false,
            reason: 'already-active',
            expiresAt: existing.expiresAt,
            count: existing.participantIds?.length || 0
        };
    }

    const metadata = await sock.groupMetadata(chatId);
    const botId = String(sock.user?.id || '').split(':')[0];
    const participants = (metadata?.participants || [])
        .map(participant => participant?.phoneNumber || participant?.id || participant?.lid)
        .filter(id => typeof id === 'string' && id.includes('@') && !id.endsWith('@g.us'))
        .filter(id => id.split('@')[0].split(':')[0] !== botId);
    const campaign = createWelcomeCampaign(participants, now, `welcome-${now}-${Math.random().toString(36).slice(2, 8)}`);
    if (!campaign.participantIds.length) {
        return { started: false, reason: 'empty-roster' };
    }

    const pending = await getPendingIntros(chatId);
    const previous = new Map();
    for (const userId of campaign.participantIds) {
        previous.set(userId, pending[userId] ?? null);
        pending[userId] = {
            joinedAt: now,
            reminded: false,
            introduced: false,
            campaignId: campaign.campaignId,
            status: 'active'
        };
    }

    await addWelcomeCampaignGroup(chatId);
    if (!await store.saveSettingVerified(chatId, WELCOME_CAMPAIGN_KEY, campaign)) {
        throw new Error('Welcome campaign state could not be persisted.');
    }
    await savePendingIntros(chatId, pending);

    try {
        const payload = buildWelcomeCampaignMessage(campaign.participantIds);
        await sock.sendMessage(chatId, payload);
    } catch (error) {
        const latest = await getPendingIntros(chatId);
        for (const userId of campaign.participantIds) {
            if (latest[userId]?.campaignId !== campaign.campaignId) continue;
            const oldRecord = previous.get(userId);
            if (oldRecord) latest[userId] = oldRecord;
            else delete latest[userId];
        }
        await savePendingIntros(chatId, latest);
        await store.saveSettingVerified(chatId, WELCOME_CAMPAIGN_KEY, null);
        throw error;
    }

    scheduleGroupIntroReminder(sock, chatId);
    return {
        started: true,
        count: campaign.participantIds.length,
        expiresAt: campaign.expiresAt
    };
}

function scheduleGroupIntroReminder(sock, chatId) {
    const existing = introReminderTimers.get(chatId);
    if (existing) clearTimeout(existing);
    getPendingIntros(chatId).then(pending => {
        const dueAt = getNextIntroReminderAt(pending, INTRO_REMINDER_DELAY_MS);
        if (!Number.isFinite(dueAt)) {
            introReminderTimers.delete(chatId);
            return;
        }
        const timer = setTimeout(async () => {
            introReminderTimers.delete(chatId);
            try {
                const latest = await getPendingIntros(chatId);
                const now = Date.now();
                const entries = getEligibleIntroReminderEntries(latest, now, INTRO_REMINDER_DELAY_MS);
                if (entries.length) {
                    const mentions = entries.map(([jid]) => jid);
                    const mentionText = mentions.map(jid => `@${jid.split('@')[0]}`).join(', ');
                    const reminder = introReminder.replace(/@?\{user\}/g, mentionText);
                    await sock.sendMessage(chatId, { text: reminder, mentions });
                    for (const [jid] of entries) if (latest[jid]) latest[jid].reminded = true;
                    await savePendingIntros(chatId, latest);
                }
                scheduleGroupIntroReminder(sock, chatId);
            } catch (error) {
                console.error('Group intro reminder error:', error.message);
                scheduleGroupIntroReminder(sock, chatId);
            }
        }, Math.max(0, dueAt - Date.now()));
        introReminderTimers.set(chatId, timer);
    }).catch(error => console.error('Could not schedule group intro reminder:', error.message));
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

export async function markMemberIntroduced(chatId, userId, messageText = '', { hasAnyMessage = false } = {}) {
    if (!await hasMaturedMindedFeatures(chatId) || !userId) return false;
    const pending = await getPendingIntros(chatId);
    const record = pending[userId];
    if (!record) return false;

    // During a manual campaign, any real member message counts as participation,
    // even if it is casual chat or media rather than a formal profile introduction.
    if (record.campaignId && hasAnyMessage) {
        const campaign = await store.getSetting(chatId, WELCOME_CAMPAIGN_KEY);
        // Casual messages count only during the original ten-minute campaign window.
        if (campaign?.campaignId === record.campaignId && isWelcomeCampaignActive(campaign, Date.now())) {
            delete pending[userId];
            await savePendingIntros(chatId, pending);
            return true;
        }
    }

    if (!looksLikeMemberIntroduction(messageText)) return false;
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
            await queueNewMemberWelcome(sock, update.id, update.participants);
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
