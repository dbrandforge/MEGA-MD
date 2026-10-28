import fs from 'fs';
import path from 'path';
import store from '../lib/lightweight_store.js';
import config from '../config.js';
import isAdmin from '../lib/isAdmin.js';

const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);
const databaseDir = path.join(process.cwd(), 'data');
const warningsPath = path.join(databaseDir, 'warnings.json');

const MUTE_DURATION_MS = (config.muteDurationHours || 10) * 60 * 60 * 1000;

function initializeWarningsFile() {
    if (!HAS_DB) {
        if (!fs.existsSync(databaseDir)) fs.mkdirSync(databaseDir, { recursive: true });
        if (!fs.existsSync(warningsPath)) fs.writeFileSync(warningsPath, JSON.stringify({}), 'utf8');
    }
}

async function getWarnings() {
    if (HAS_DB) {
        return (await store.getSetting('global', 'warnings')) || {};
    }
    try {
        return JSON.parse(fs.readFileSync(warningsPath, 'utf8'));
    } catch {
        return {};
    }
}

async function saveWarnings(warnings) {
    if (HAS_DB) {
        await store.saveSetting('global', 'warnings', warnings);
    } else {
        fs.writeFileSync(warningsPath, JSON.stringify(warnings, null, 2));
    }
}

async function muteUser(sock, chatId, userId, durationMs) {
    try {
        // Try modern restrict
        await sock.groupParticipantsUpdate(chatId, [userId], 'restrict');
    } catch (e1) {
        try {
            // Fallback: some Baileys versions use different action
            await sock.groupSettingUpdate(chatId, 'announcement');
            // Can't easily mute one person this way, so just try restrict again with delay
            await new Promise(r => setTimeout(r, 500));
            await sock.groupParticipantsUpdate(chatId, [userId], 'restrict');
        } catch (e2) {
            console.error('Mute failed:', e1.message, e2.message);
            return false;
        }
    }

    // Schedule unmute
    setTimeout(async () => {
        try {
            await sock.groupParticipantsUpdate(chatId, [userId], 'unrestrict');
            await sock.sendMessage(chatId, {
                text: `🔊 @${userId.split('@')[0]} has been unmuted.`,
                mentions: [userId]
            });
        } catch (e) {
            console.error('Unmute failed:', e);
        }
    }, durationMs);

    return true;
}

export default {
    command: 'warn',
    aliases: ['warning'],
    category: 'admin',
    description: 'Warn a user (auto-mute for 10 hours after 3 warnings)',
    usage: '.warn [@user] or reply to message',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo } = context;

        try {
            initializeWarningsFile();

            // Double-check bot is admin with improved detection
            const adminStatus = await isAdmin(sock, chatId, senderId);
            if (!adminStatus.isBotAdmin) {
                return sock.sendMessage(chatId, {
                    text: '❌ Bot does not appear to be admin. Please make sure the bot is an admin and try again.\n\n(If the bot *is* admin, this may be a temporary detection issue — try again in a few seconds.)',
                    ...channelInfo
                }, { quoted: message });
            }

            let userToWarn;
            const mentionedJids = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;

            if (mentionedJids?.length > 0) {
                userToWarn = mentionedJids[0];
            } else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
                userToWarn = message.message.extendedTextMessage.contextInfo.participant;
            }

            if (!userToWarn) {
                return sock.sendMessage(chatId, {
                    text: '❌ Please mention the user or reply to their message to warn!',
                    ...channelInfo
                }, { quoted: message });
            }

            const warnings = await getWarnings();
            if (!warnings[chatId]) warnings[chatId] = {};
            if (!warnings[chatId][userToWarn]) warnings[chatId][userToWarn] = 0;

            warnings[chatId][userToWarn]++;
            await saveWarnings(warnings);

            const count = warnings[chatId][userToWarn];
            const maxWarns = config.warnCount || 3;

            const warningMessage = `*『 WARNING 』*\n\n` +
                `👤 *User:* @${userToWarn.split('@')[0]}\n` +
                `⚠️ *Warnings:* ${count}/${maxWarns}\n` +
                `👑 *By:* @${senderId.split('@')[0]}\n` +
                `📅 *Date:* ${new Date().toLocaleString()}\n\n` +
                (count >= maxWarns
                    ? `🔇 *Action:* User will be muted for ${config.muteDurationHours || 10} hours.`
                    : `Next warning will result in a ${config.muteDurationHours || 10}-hour mute.`);

            await sock.sendMessage(chatId, {
                text: warningMessage,
                mentions: [userToWarn, senderId],
                ...channelInfo
            });

            if (count >= maxWarns) {
                const muted = await muteUser(sock, chatId, userToWarn, MUTE_DURATION_MS);

                delete warnings[chatId][userToWarn];
                await saveWarnings(warnings);

                if (muted) {
                    await sock.sendMessage(chatId, {
                        text: `🔇 @${userToWarn.split('@')[0]} has been *muted for ${config.muteDurationHours || 10} hours* after reaching ${maxWarns} warnings.`,
                        mentions: [userToWarn],
                        ...channelInfo
                    });
                } else {
                    await sock.sendMessage(chatId, {
                        text: `⚠️ Could not mute the user automatically.\nPlease mute them manually. The bot may need “Restrict members” permission.`,
                        ...channelInfo
                    });
                }
            }

        } catch (error) {
            console.error('Error in warn command:', error);
            await sock.sendMessage(chatId, {
                text: `❌ Failed to warn user: ${error.message}`,
                ...channelInfo
            }, { quoted: message });
        }
    }
};
