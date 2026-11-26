import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getUserGender } from './gender.js';
import { filterParticipantsByGender } from '../lib/genderTagging.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
async function downloadMediaMessage(message, mediaType) {
    const stream = await downloadContentFromMessage(message, mediaType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    const tempDir = path.join(__dirname, '../temp/');
    fs.mkdirSync(tempDir, { recursive: true });
    const filePath = path.join(tempDir, `${Date.now()}.${mediaType}`);
    fs.writeFileSync(filePath, buffer);
    return filePath;
}
export default {
    command: 'tag',
    aliases: [],
    category: 'admin',
    description: 'Tag all members, or only members saved as ladies/guys',
    usage: '.tag [ladies|guys] [message] or reply to a message',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, channelInfo } = context;
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants || [];
        const requestedGender = (args[0] || '').toLowerCase();
        const genderAliases = {
            ladies: 'lady', lady: 'lady', girls: 'lady', women: 'lady', female: 'lady', females: 'lady',
            guys: 'guy', guy: 'guy', men: 'guy', male: 'guy', males: 'guy'
        };
        const gender = genderAliases[requestedGender] || null;
        if (requestedGender && !gender) {
            return sock.sendMessage(chatId, {
                text: 'Use *.tag ladies* or *.tag guys*. Members without a saved gender are not included.',
                ...channelInfo
            }, { quoted: message });
        }
        const mentionedJidList = gender
            ? await filterParticipantsByGender(participants, gender, userId => getUserGender(userId, sock))
            : participants.map(participant => participant.id || participant.phoneNumber || participant.lid).filter(Boolean);
        if (gender && !mentionedJidList.length) {
            return sock.sendMessage(chatId, {
                text: `No members with a saved gender of *${gender}* were found in this group.`,
                ...channelInfo
            }, { quoted: message });
        }
        const replyMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const tagText = args.join(' ');
        if (replyMessage) {
            let messageContent = {};
            if (replyMessage.imageMessage) {
                const filePath = await downloadMediaMessage(replyMessage.imageMessage, 'image');
                messageContent = {
                    image: { url: filePath },
                    caption: tagText || replyMessage.imageMessage.caption || '',
                    mentions: mentionedJidList,
                    ...channelInfo
                };
            }
            else if (replyMessage.videoMessage) {
                const filePath = await downloadMediaMessage(replyMessage.videoMessage, 'video');
                messageContent = {
                    video: { url: filePath },
                    caption: tagText || replyMessage.videoMessage.caption || '',
                    mentions: mentionedJidList,
                    ...channelInfo
                };
            }
            else if (replyMessage.conversation || replyMessage.extendedTextMessage) {
                messageContent = {
                    text: replyMessage.conversation || replyMessage.extendedTextMessage.text,
                    mentions: mentionedJidList,
                    ...channelInfo
                };
            }
            else if (replyMessage.documentMessage) {
                const filePath = await downloadMediaMessage(replyMessage.documentMessage, 'document');
                messageContent = {
                    document: { url: filePath },
                    fileName: replyMessage.documentMessage.fileName,
                    caption: tagText || '',
                    mentions: mentionedJidList,
                    ...channelInfo
                };
            }
            if (Object.keys(messageContent).length > 0) {
                await sock.sendMessage(chatId, messageContent);
            }
        }
        else {
            await sock.sendMessage(chatId, {
                text: tagText || "Tagged message",
                mentions: mentionedJidList,
                ...channelInfo
            });
        }
    }
};
