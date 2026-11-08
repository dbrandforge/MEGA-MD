/*****************************************************************************
 *                                                                           *
 *                     Developed By Qasim Ali                                *
 *                                                                           *
 *  🌐  GitHub   : https://github.com/GlobalTechInfo                         *
 *  ▶️  YouTube  : https://youtube.com/@GlobalTechInfo                       *
 *  💬  WhatsApp : https://whatsapp.com/channel/0029VagJIAr3bbVBCpEkAM07     *
 *                                                                           *
 *    © 2026 GlobalTechInfo. All rights reserved.                            *
 *                                                                           *
 *    Description: This file is part of the MEGA-MD Project.                 *
 *                 Unauthorized copying or distribution is prohibited.       *
 *                                                                           *
 *****************************************************************************/
export default {
    command: 'add',
    aliases: ['invite', 'gcadd', 'addgc'],
    category: 'admin',
    description: 'Add a user or import multiple contacts from a VCF file',
    usage: '.add <number> | attach .vcf + .add | .add confirm | .add cancel',
    groupOnly: true,
    adminOnly: true,
    async handler(sock, message, args, context) {
        const { chatId, senderId, channelInfo } = context;
        const action = String(args?.[0] || '').toLowerCase();
        if (action === 'cancel') {
            const pending = await store.getSetting(chatId, PENDING_VCF_KEY);
            if (!pending) return sock.sendMessage(chatId, { text: 'There is no pending VCF import to cancel.', ...channelInfo }, { quoted: message });
            if (pending.requestedBy && pending.requestedBy !== senderId) return sock.sendMessage(chatId, { text: 'Only the admin who prepared this VCF import can cancel it.', ...channelInfo }, { quoted: message });
            await store.saveSettingVerified(chatId, PENDING_VCF_KEY, null);
            return sock.sendMessage(chatId, { text: '🛑 Pending VCF contact import cancelled. No contacts were added.', ...channelInfo }, { quoted: message });
        }
        if (action === 'confirm') {
            const pending = await store.getSetting(chatId, PENDING_VCF_KEY);
            if (!pending || !Array.isArray(pending.contacts) || !pending.contacts.length) return sock.sendMessage(chatId, { text: 'There is no pending VCF import. Attach a .vcf file and send *.add* first.', ...channelInfo }, { quoted: message });
            if (pending.requestedBy && pending.requestedBy !== senderId) return sock.sendMessage(chatId, { text: 'Only the admin who prepared this VCF import can confirm it.', ...channelInfo }, { quoted: message });
            if (Date.now() - Number(pending.createdAt || 0) > 10 * 60 * 1000) {
                await store.saveSettingVerified(chatId, PENDING_VCF_KEY, null);
                return sock.sendMessage(chatId, { text: 'This VCF preview has expired. Attach the file again to prepare a fresh import.', ...channelInfo }, { quoted: message });
            }
            if (pending.processing) return sock.sendMessage(chatId, { text: 'This VCF import is already being processed.', ...channelInfo }, { quoted: message });
            pending.processing = true;
            if (!await store.saveSettingVerified(chatId, PENDING_VCF_KEY, pending)) return sock.sendMessage(chatId, { text: 'Could not lock the pending import for processing. Nothing was added.', ...channelInfo }, { quoted: message });
            try {
                const result = await processVcfImport(sock, chatId, pending);
                await store.saveSettingVerified(chatId, PENDING_VCF_KEY, null);
                return sock.sendMessage(chatId, {
                    text: `📇 *VCF IMPORT RESULTS*\\n\\nContacts in file: *${result.total}*\\nAlready in group: *${result.alreadyPresent}*\\nSuccessfully added: *${result.added.length}*\\nInvite required: *${result.invited.length}*\\nPrivacy blocked: *${result.privacyBlocked.length}*\\nFailed: *${result.failed.length}*\\n\\nWhatsApp privacy settings may require some contacts to accept an invite. No failed contact is reported as added.`,
                    mentions: result.added.map(item => item.jid),
                    ...channelInfo
                }, { quoted: message });
            } catch (error) {
                pending.processing = false;
                await store.saveSettingVerified(chatId, PENDING_VCF_KEY, pending);
                return sock.sendMessage(chatId, { text: `❌ VCF import could not be completed: ${String(error?.message || error).slice(0, 180)}. The preview was retained so you can retry with *.add confirm*.`, ...channelInfo }, { quoted: message });
            }
        }

        const vcfTarget = getVcfTarget(message);
        const vcfDocument = vcfTarget?.message?.documentMessage;
        const isVcf = !!vcfDocument && (/\\.vcf$/i.test(vcfDocument.fileName || '') || /vcard/i.test(vcfDocument.mimetype || '') || action === 'vcf');
        if (isVcf) {
            const size = Number(vcfDocument.fileLength || 0);
            if (size > 2 * 1024 * 1024) return sock.sendMessage(chatId, { text: 'VCF file exceeds the 2 MB import limit. Split the contact file and try again.', ...channelInfo }, { quoted: message });
            try {
                const buffer = await downloadMediaMessage(vcfTarget, 'buffer', {}, { logger: sock.logger, reuploadRequest: sock.updateMediaMessage });
                const contacts = parseVCardContacts(buffer.toString('utf8')).slice(0, 100);
                if (!contacts.length) return sock.sendMessage(chatId, { text: 'No valid international phone numbers were found in that VCF. Include country codes; Nigerian local 11-digit numbers beginning with 0 are normalized automatically.', ...channelInfo }, { quoted: message });
                const pending = { contacts, requestedBy: senderId, createdAt: Date.now(), processing: false };
                if (!await store.saveSettingVerified(chatId, PENDING_VCF_KEY, pending)) throw new Error('Could not save the import preview.');
                return sock.sendMessage(chatId, {
                    text: `📇 *VCF CONTACT IMPORT PREVIEW*\\n\\nValid unique contacts: *${contacts.length}*\\nImport limit: *100 contacts per batch*\\n\\nThe bot will check existing members, then attempt additions in small batches. Contacts whose WhatsApp privacy settings prevent direct addition will be reported separately.\\n\\nConfirm with *.add confirm* or cancel with *.add cancel*. Preview expires after 10 minutes.`,
                    ...channelInfo
                }, { quoted: message });
            } catch (error) {
                return sock.sendMessage(chatId, { text: `❌ Could not read the VCF file: ${String(error?.message || error).slice(0, 180)}`, ...channelInfo }, { quoted: message });
            }
        }

        let targetNumber = null;
        if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quotedMsg = message.message.extendedTextMessage.contextInfo.quotedMessage;
            const quotedParticipant = message.message.extendedTextMessage.contextInfo.participant;
            if (quotedMsg.contactMessage) {
                const vcard = quotedMsg.contactMessage.vcard;
                const phoneMatch = vcard.match(/waid=(\d+)/);
                if (phoneMatch) {
                    targetNumber = phoneMatch[1];
                }
                else {
                    const telMatch = vcard.match(/TEL.*?:(\+?\d+)/);
                    if (telMatch) {
                        targetNumber = telMatch[1].replace(/\D/g, '');
                    }
                }
            }
            else if (quotedMsg.conversation || quotedMsg.extendedTextMessage?.text) {
                const text = quotedMsg.conversation || quotedMsg.extendedTextMessage.text;
                const numberMatch = text.match(/(\+?\d{10,15})/);
                if (numberMatch) {
                    targetNumber = numberMatch[1].replace(/\D/g, '');
                }
            }
            else if (quotedParticipant) {
                targetNumber = quotedParticipant.split('@')[0];
            }
        }
        if (!targetNumber && args.length > 0) {
            const input = args.join(' ');
            const cleaned = input.replace(/[^\d+]/g, '');
            targetNumber = cleaned.replace(/^\+/, '');
        }
        if (!targetNumber) {
            return await sock.sendMessage(chatId, {
                text: `❌ *Please provide a number to add!*

*Usage:*
• \`.add 923051234567\`
• \`.add +923051234567\`
• \`.add 92 305 1234567\`
• Reply to a vcard with \`.add\`
• Reply to a message with \`.add\``,
                ...channelInfo
            }, { quoted: message });
        }
        if (!targetNumber.startsWith('1') && !targetNumber.startsWith('2') && !targetNumber.startsWith('3') &&
            !targetNumber.startsWith('4') && !targetNumber.startsWith('5') && !targetNumber.startsWith('6') &&
            !targetNumber.startsWith('7') && !targetNumber.startsWith('8') && !targetNumber.startsWith('9')) {
            return await sock.sendMessage(chatId, {
                text: '❌ *Invalid number format!*\n\nPlease include the country code.\nExample: 923051234567',
                ...channelInfo
            }, { quoted: message });
        }
        const targetJid = `${targetNumber}@s.whatsapp.net`;
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            const participants = groupMetadata.participants.map((p) => p.id);
            if (participants.includes(targetJid)) {
                return await sock.sendMessage(chatId, {
                    text: `⚠️ *User is already in the group!*\n\n${targetNumber}`,
                    ...channelInfo
                }, { quoted: message });
            }
            const result = await sock.groupParticipantsUpdate(chatId, [targetJid], 'add');
            if (result[0].status === '200') {
                await sock.sendMessage(chatId, {
                    text: `✅ *Successfully added!*\n\n@${targetNumber}`,
                    mentions: [targetJid],
                    ...channelInfo
                }, { quoted: message });
            }
            else if (result[0].status === '403') {
                await sock.sendMessage(chatId, {
                    text: `❌ *Failed to add user!*\n\n*Reason:* User has privacy settings that prevent being added to groups.\n\n*Solution:* Send them the group invite link.`,
                    ...channelInfo
                }, { quoted: message });
            }
            else if (result[0].status === '408') {
                await sock.sendMessage(chatId, {
                    text: `⚠️ *Invite sent!*\n\nUser needs to accept the invitation to join.`,
                    ...channelInfo
                }, { quoted: message });
            }
            else {
                await sock.sendMessage(chatId, {
                    text: `❌ *Failed to add user!*\n\n*Status:* ${result[0].status}\n\nThe user may have blocked the bot or changed their privacy settings.`,
                    ...channelInfo
                }, { quoted: message });
            }
        }
        catch (error) {
            console.error('Add command error:', error);
            await sock.sendMessage(chatId, {
                text: `❌ *Error adding user!*\n\n${error.message}`,
                ...channelInfo
            }, { quoted: message });
        }
    }
};
/*****************************************************************************
 *                                                                           *
 *                     Developed By Qasim Ali                                *
 *                                                                           *
 *  🌐  GitHub   : https://github.com/GlobalTechInfo                         *
 *  ▶️  YouTube  : https://youtube.com/@GlobalTechInfo                       *
 *  💬  WhatsApp : https://whatsapp.com/channel/0029VagJIAr3bbVBCpEkAM07     *
 *                                                                           *
 *    © 2026 GlobalTechInfo. All rights reserved.                            *
 *                                                                           *
 *    Description: This file is part of the MEGA-MD Project.                 *
 *                 Unauthorized copying or distribution is prohibited.       *
 *                                                                           *
 *****************************************************************************/
