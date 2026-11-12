import {
    loadBirthdayRegistry,
    saveBirthdayRegistry,
    normalizeBirthdayUserId,
    parseBirthdayDate,
    formatBirthdayDate
} from '../lib/birthdayService.js';

function cleanName(value, fallback) {
    return String(value || fallback || 'Member').replace(/[\r\n@]/g, ' ').trim().slice(0, 50) || 'Member';
}

async function senderIsGroupAdmin(sock, chatId, senderId, message) {
    if (!chatId?.endsWith('@g.us')) return false;
    try {
        const metadata = await sock.groupMetadata(chatId);
        const identities = new Set([
            normalizeBirthdayUserId(senderId),
            normalizeBirthdayUserId(message.key?.participant),
            normalizeBirthdayUserId(message.key?.participantAlt)
        ].filter(Boolean));
        return (metadata.participants || []).some(participant =>
            identities.has(normalizeBirthdayUserId(participant.id)) && Boolean(participant.admin)
        );
    } catch (error) {
        console.error('[BIRTHDAY] Could not verify group admin:', error.message);
        return false;
    }
}

function birthdayHelp(isGroup) {
    return `🎂 *FORGE GUARD BIRTHDAYS*

• *.birthday 24/09* — register your birthday
• *.birthday* — view your saved birthday
• *.birthday dm on/off* — opt in/out of a private birthday greeting (use in DM)
${isGroup ? '• *.birthday join* — add your saved birthday to this group\n• *.birthday list* — birthdays shared with this group\n• *.birthday @member 24/09* — admin changes a member birthday\n• *.birthday remove @member* — admin removes a registration' : ''}
\nYour date is stored as day/month only; no birth year is collected.
After registration, only a group admin, the creator or the bot can change the birthday date.`;
}

export default {
    command: 'birthday',
    aliases: ['bday', 'birthdays'],
    category: 'general',
    description: 'Register and manage birthday greetings.',
    usage: '.birthday 24/09 | .birthday dm on/off | .birthday list',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const senderId = context.senderId || message.key.participant || chatId;
        const isGroup = context.isGroup ?? chatId.endsWith('@g.us');
        const isCreatorOrBot = Boolean(context.isCreatorOrBot || message.key?.fromMe);
        const action = String(args?.[0] || '').toLowerCase();
        const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const registry = await loadBirthdayRegistry();
        const ownKey = normalizeBirthdayUserId(senderId);
        const ownRecord = registry.users[ownKey];

        if (!action || action === 'help') {
            const text = ownRecord?.birthday
                ? `🎂 Your saved birthday is *${formatBirthdayDate(ownRecord.birthday)}*.\n\n${birthdayHelp(isGroup)}`
                : birthdayHelp(isGroup);
            return sock.sendMessage(chatId, { text, ...context.channelInfo }, { quoted: message });
        }

        if (action === 'dm') {
            if (isGroup) {
                return sock.sendMessage(chatId, { text: 'For privacy, manage your private birthday greeting in a DM with Forge Guard: *.birthday dm on* or *.birthday dm off*.', ...context.channelInfo }, { quoted: message });
            }
            if (!ownRecord?.birthday) {
                return sock.sendMessage(chatId, { text: 'Register your birthday first with *.birthday 24/09*.', ...context.channelInfo }, { quoted: message });
            }
            const choice = String(args?.[1] || '').toLowerCase();
            if (!['on', 'off'].includes(choice)) {
                return sock.sendMessage(chatId, { text: 'Use *.birthday dm on* or *.birthday dm off*.', ...context.channelInfo }, { quoted: message });
            }
            ownRecord.dm = choice === 'on'
                ? { enabled: true, jid: chatId }
                : { enabled: false, jid: ownRecord.dm?.jid || chatId };
            await saveBirthdayRegistry(registry);
            return sock.sendMessage(chatId, { text: choice === 'on'
                ? '✅ Your private birthday greeting is enabled. I’ll send it here at 8:00 AM on your birthday.'
                : '✅ Private birthday greetings are now off. Your group birthday greetings are unaffected.',
                ...context.channelInfo }, { quoted: message });
        }

        if (action === 'list') {
            if (!isGroup) {
                return sock.sendMessage(chatId, { text: 'Use *.birthday list* inside a group to see birthdays shared with that group.', ...context.channelInfo }, { quoted: message });
            }
            const entries = Object.values(registry.users)
                .filter(record => record?.birthday && record.groups?.[chatId])
                .sort((a, b) => a.birthday.month - b.birthday.month || a.birthday.day - b.birthday.day);
            const body = entries.length
                ? entries.map(record => `• *${formatBirthdayDate(record.birthday)}* — ${cleanName(record.name, 'Member')}`).join('\n')
                : 'No birthdays have been shared with this group yet.';
            return sock.sendMessage(chatId, { text: `🎂 *BIRTHDAYS SHARED IN THIS GROUP*\n\n${body}`, ...context.channelInfo }, { quoted: message });
        }

        if (action === 'join') {
            if (!isGroup) {
                return sock.sendMessage(chatId, { text: 'Use *.birthday join* inside the group you want to celebrate you in.', ...context.channelInfo }, { quoted: message });
            }
            if (!ownRecord?.birthday) {
                return sock.sendMessage(chatId, { text: 'You have no saved birthday yet. Register with *.birthday 24/09* first.', ...context.channelInfo }, { quoted: message });
            }
            ownRecord.groups ||= {};
            ownRecord.groups[chatId] = message.key?.participant || senderId;
            await saveBirthdayRegistry(registry);
            return sock.sendMessage(chatId, { text: `✅ Your birthday is now shared with this group: *${formatBirthdayDate(ownRecord.birthday)}*.`, ...context.channelInfo }, { quoted: message });
        }

        if (action === 'remove') {
            if (!mentioned.length || (!isCreatorOrBot && !(await senderIsGroupAdmin(sock, chatId, senderId, message)))) {
                return sock.sendMessage(chatId, { text: 'Only a group admin, the creator or the bot can remove a birthday registration. Mention the member: *.birthday remove @member*.', ...context.channelInfo }, { quoted: message });
            }
            const targetKey = normalizeBirthdayUserId(mentioned[0]);
            if (!registry.users[targetKey]) {
                return sock.sendMessage(chatId, { text: 'I could not find a saved birthday for that member.', ...context.channelInfo }, { quoted: message });
            }
            delete registry.users[targetKey];
            await saveBirthdayRegistry(registry);
            return sock.sendMessage(chatId, { text: `✅ Birthday registration removed for @${mentioned[0].split('@')[0]}.`, mentions: [mentioned[0]], ...context.channelInfo }, { quoted: message });
        }

        // Admin/creator/bot may set or change another member's date.
        const dateInput = mentioned.length
            ? (args.find(value => /^(\d{1,2})[/.\-](\d{1,2})$/.test(value)) || '')
            : action;
        if (mentioned.length && !dateInput) {
            return sock.sendMessage(chatId, { text: 'Include the date after the mention. Example: *.birthday @member 24/09*.', ...context.channelInfo }, { quoted: message });
        }
        if (mentioned.length) {
            const authorized = isCreatorOrBot || await senderIsGroupAdmin(sock, chatId, senderId, message);
            if (!authorized) {
                return sock.sendMessage(chatId, { text: 'Only a group admin, the creator or the bot can change a registered birthday.', ...context.channelInfo }, { quoted: message });
            }
            const parsed = parseBirthdayDate(dateInput);
            if (!parsed) return sock.sendMessage(chatId, { text: 'Invalid date. Use DD/MM, for example *.birthday @member 24/09*.', ...context.channelInfo }, { quoted: message });
            const targetJid = mentioned[0];
            const targetKey = normalizeBirthdayUserId(targetJid);
            const record = registry.users[targetKey] || { userId: targetKey, name: cleanName('', targetKey), groups: {}, deliveries: {} };
            record.birthday = parsed;
            record.groups ||= {};
            if (isGroup) record.groups[chatId] = targetJid;
            registry.users[targetKey] = record;
            await saveBirthdayRegistry(registry);
            return sock.sendMessage(chatId, { text: `✅ Birthday for @${targetJid.split('@')[0]} saved as *${formatBirthdayDate(parsed)}*.`, mentions: [targetJid], ...context.channelInfo }, { quoted: message });
        }

        const parsed = parseBirthdayDate(action);
        if (!parsed) {
            return sock.sendMessage(chatId, { text: birthdayHelp(isGroup) + '\n\nInvalid date. Use DD/MM, for example *.birthday 24/09*.', ...context.channelInfo }, { quoted: message });
        }
        if (ownRecord?.birthday && formatBirthdayDate(ownRecord.birthday) !== formatBirthdayDate(parsed)) {
            return sock.sendMessage(chatId, { text: `Your birthday is already saved as *${formatBirthdayDate(ownRecord.birthday)}*. Only a group admin, the creator or the bot can change it.`, ...context.channelInfo }, { quoted: message });
        }
        const record = ownRecord || { userId: ownKey, birthday: null, name: cleanName(message.pushName, ownKey), groups: {}, deliveries: {} };
        record.birthday = parsed;
        record.name = record.name || cleanName(message.pushName, ownKey);
        record.groups ||= {};
        if (isGroup) record.groups[chatId] = message.key?.participant || senderId;
        registry.users[ownKey] = record;
        await saveBirthdayRegistry(registry);
        return sock.sendMessage(chatId, { text: `🎉 Your birthday is saved as *${formatBirthdayDate(parsed)}*.${isGroup ? '\n\nYou are now included in this group’s birthday celebrations.' : '\n\nTo receive a group greeting, use *.birthday join* inside that group.'}\n\nPrivate DM greetings are optional: *.birthday dm on* in a private chat.`, ...context.channelInfo }, { quoted: message });
    }
};
