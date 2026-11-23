import config from '../config.js';
import { isOwnerOnly, getCachedGroupMetadata } from '../lib/isOwner.js';
import { getAnonymousSubmissionRecord, recordAnonymousAuditLookup } from '../lib/anonymousAudit.js';

function cleanNumber(value) {
    return String(value || '').replace(/\D/g, '');
}

function getQuotedMessageId(message) {
    const content = message?.message || {};
    const candidates = [
        content.extendedTextMessage?.contextInfo?.stanzaId,
        content.imageMessage?.contextInfo?.stanzaId,
        content.videoMessage?.contextInfo?.stanzaId,
        content.documentMessage?.contextInfo?.stanzaId,
        content.buttonsResponseMessage?.contextInfo?.stanzaId,
        content.listResponseMessage?.contextInfo?.stanzaId
    ];
    return candidates.find(value => typeof value === 'string' && value.trim()) || null;
}

async function isVerifiedCreator(sock, message, context) {
    const candidates = [
        context?.senderId,
        message?.key?.participant,
        message?.key?.participantAlt,
        message?.key?.remoteJidAlt
    ].filter(Boolean);

    if (candidates.some(isOwnerOnly)) return true;

    const groupId = context?.chatId || message?.key?.remoteJid || '';
    if (!groupId.endsWith('@g.us')) return false;

    const lid = candidates.find(value => String(value).includes('@lid'));
    if (!lid) return false;

    try {
        const metadata = await getCachedGroupMetadata(sock, groupId);
        const participant = (metadata?.participants || []).find(item =>
            item?.lid === lid || item?.id === lid
        );
        return Boolean(participant?.id && isOwnerOnly(participant.id));
    } catch {
        return false;
    }
}

function formatDate(value) {
    if (!value) return 'Not recorded';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown' : date.toISOString();
}

function formatValue(value) {
    return value === undefined || value === null || value === '' ? 'Not exposed' : String(value);
}

export default {
    command: 'anontrace',
    aliases: ['anonlookup', 'anonforensics'],
    category: 'owner',
    strictOwnerOnly: true,
    description: 'Privately retrieve forensic metadata for an anonymous submission',
    usage: '.anontrace <WhatsApp-message-ID> (or reply to an anonymous image)',
    async handler(sock, message, args, context) {
        const chatId = context?.chatId || message?.key?.remoteJid || '';
        const authorized = await isVerifiedCreator(sock, message, context);
        if (!authorized) {
            return sock.sendMessage(chatId, {
                text: 'This forensic lookup is restricted to the verified creator.'
            }, { quoted: message });
        }

        const creatorNumber = cleanNumber(config.creatorNumber || config.ownerNumber);
        if (!creatorNumber) {
            return sock.sendMessage(chatId, {
                text: 'Creator DM is not configured. No forensic data was disclosed.'
            }, { quoted: message });
        }
        const creatorJid = creatorNumber + '@s.whatsapp.net';
        const reference = (Array.isArray(args) ? args.join(' ') : String(args || '')).trim() || getQuotedMessageId(message);
        if (!reference) {
            return sock.sendMessage(creatorJid, {
                text: 'Usage: .anontrace <WhatsApp-message-ID>\nYou can also reply to an anonymous image with .anontrace.'
            });
        }
        if (reference.length > 160 || /[\r\n]/.test(reference)) {
            return sock.sendMessage(creatorJid, { text: 'Invalid message reference.' });
        }

        try {
            const record = await getAnonymousSubmissionRecord(reference);
            await recordAnonymousAuditLookup({ actorId: context?.senderId, reference, found: Boolean(record) });
            if (!record) {
                return sock.sendMessage(creatorJid, {
                    text: 'No forensic record was found for that message. It may predate audit logging or the reference may be incorrect.'
                });
            }

            const c = record.client || {};
            const report = [
                '🔒 *FORGE GUARD — ANONYMOUS FORENSIC RECORD*',
                '',
                'Submission ID: ' + record.submissionId,
                'Group JID: ' + record.groupId,
                'Submitted: ' + formatDate(record.submittedAt),
                'Delivery status: ' + (record.status || 'Unknown'),
                'Delivered: ' + formatDate(record.deliveredAt),
                'WhatsApp message ID: ' + formatValue(record.whatsappMessageId),
                '',
                '*NETWORK*',
                'Public IP: ' + record.ipAddress,
                'IP correlation: ' + formatValue(record.ipCorrelationHash),
                '',
                '*BROWSER & DEVICE*',
                'Browser: ' + formatValue(c.browser) + ' ' + (c.browserVersion || ''),
                'Operating system: ' + formatValue(c.os) + ' ' + (c.osVersion || ''),
                'Device class: ' + formatValue(c.deviceType),
                'Device model: ' + formatValue(c.deviceModel),
                'Language: ' + formatValue(c.language),
                'Client Hints: ' + JSON.stringify(c.clientHints || {}),
                '',
                '*RAW USER-AGENT*',
                record.userAgent || 'Not exposed',
                '',
                'Content integrity HMAC: ' + formatValue(record.contentIntegrityHash),
                '',
                'Note: IP/device data are investigative indicators, not proof of a person’s identity.'
            ].join('\n');

            // Always deliver the sensitive report to the primary creator DM only.
            // Never include any forensic field in the originating group response.
            await sock.sendMessage(creatorJid, { text: report });
        } catch (error) {
            console.error('Anonymous forensic lookup failed:', String(error?.message || 'unknown').slice(0, 180));
            await sock.sendMessage(creatorJid, {
                text: 'Anonymous forensic lookup failed. Check audit database connectivity and encryption-key configuration.'
            }).catch(() => {});
        }
    }
};
