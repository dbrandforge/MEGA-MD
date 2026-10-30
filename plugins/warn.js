import fs from 'fs';
import path from 'path';
import store from '../lib/lightweight_store.js';
import config from '../config.js';
import isAdmin from '../lib/isAdmin.js';
import { softMuteUser } from './softmute.js';

const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);
const databaseDir = path.join(process.cwd(), 'data');
const warningsPath = path.join(databaseDir, 'warnings.json');

function initializeWarningsFile() {
    if (!HAS_DB) {
        if (!fs.existsSync(databaseDir)) fs.mkdirSync(databaseDir, { recursive: true });
        if (!fs.existsSync(warningsPath)) fs.writeFileSync(warningsPath, JSON.stringify({}), 'utf8');
    }
}

async function getWarnings() {
    if (HAS_DB) return (await store.getSetting('global', 'warnings')) || {};
    try {
        return JSON.parse(fs.readFileSync(warningsPath, 'utf8'));
    } catch {
        return {};
    }
}

async function saveWarnings(warnings) {
    if (HAS_DB) await store.saveSetting('global', 'warnings', warnings);
    else fs.writeFileSync(warningsPath, JSON.stringify(warnings, null, 2));
}

export default {
    command: 'warn',
    aliases: ['warning'],
    category: 'admin',
    description: 'Warn a user (auto soft-mute 10 hours after 3 warnings)',
    usage: '.warn [@user] or reply to message',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo } = context;

        try {
            initializeWarningsFile();

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

            const rawCommandText = message.message?.conversation
                || message.message?.extendedTextMessage?.text
                || message.message?.imageMessage?.caption
                || message.message?.videoMessage?.caption
                || '';
            const reason = rawCommandText
                .replace(/^\\s*\\S+\\s*/, '')
                .replace(/@\\d+/g, '')
                .trim() || 'No reason provided.';

            const warnings = await getWarnings();
            if (!warnings[chatId]) warnings[chatId] = {};
            if (!warnings[chatId][userToWarn]) warnings[chatId][userToWarn] = 0;

            warnings[chatId][userToWarn]++;
            await saveWarnings(warnings);

            const count = warnings[chatId][userToWarn];
            const maxWarns = config.warnCount || 3;
            const hours = config.muteDurationHours || 10;

            const warningMessage = `*『 WARNING 』*\n\n` +
                `👤 *User:* @${userToWarn.split('@')[0]}\n` +
                `⚠️ *Warnings:* ${count}/${maxWarns}\n` +
                `👑 *By:* @${senderId.split('@')[0]}\n` +
                `📅 *Date:* ${new Date().toLocaleString()}\n\n` +
                (count >= maxWarns
                    ? `🔇 *Action:* Soft-muted for ${hours} hours (messages will be deleted).`
                    : `Next warning(s) will result in a ${hours}-hour soft mute.`);

            await sock.sendMessage(chatId, {
                text: warningMessage,
                mentions: [userToWarn, senderId],
                ...channelInfo
            });

            if (count >= maxWarns) {
                await softMuteUser(sock, chatId, userToWarn, hours);
                delete warnings[chatId][userToWarn];
                await saveWarnings(warnings);

                await sock.sendMessage(chatId, {
                    text: `🔇 @${userToWarn.split('@')[0]} has been *soft-muted for ${hours} hours* after reaching ${maxWarns} warnings.\n\nTheir messages will be deleted automatically until the mute expires.`,
                    mentions: [userToWarn],
                    ...channelInfo
                });
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
