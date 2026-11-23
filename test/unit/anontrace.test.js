import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    isOwnerOnly: vi.fn(),
    getCachedGroupMetadata: vi.fn(),
    getAnonymousSubmissionRecord: vi.fn(),
    recordAnonymousAuditLookup: vi.fn()
}));

vi.mock('../../config.js', () => ({
    default: { creatorNumber: '2349034451454', ownerNumber: '2349034451454' }
}));
vi.mock('../../lib/isOwner.js', () => ({
    isOwnerOnly: mocks.isOwnerOnly,
    getCachedGroupMetadata: mocks.getCachedGroupMetadata
}));
vi.mock('../../lib/anonymousAudit.js', () => ({
    getAnonymousSubmissionRecord: mocks.getAnonymousSubmissionRecord,
    recordAnonymousAuditLookup: mocks.recordAnonymousAuditLookup
}));

import anontrace from '../../plugins/anontrace.js';

const creatorJid = '2349034451454@s.whatsapp.net';
const groupJid = '120363412352644891@g.us';

function makeMessage(overrides = {}) {
    return {
        key: { remoteJid: groupJid, participant: creatorJid },
        message: { conversation: '.anontrace msg-123' },
        ...overrides
    };
}

describe('creator-only anonymous forensic lookup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.isOwnerOnly.mockReturnValue(true);
        mocks.getAnonymousSubmissionRecord.mockResolvedValue({
            submissionId: 'sub-123',
            groupId: groupJid,
            submittedAt: new Date('2026-11-23T10:00:00Z'),
            deliveredAt: new Date('2026-11-23T10:00:02Z'),
            status: 'sent',
            whatsappMessageId: 'msg-123',
            ipAddress: '203.0.113.10',
            userAgent: 'ExampleBrowser/1.0',
            ipCorrelationHash: 'ip-hash',
            contentIntegrityHash: 'content-hash',
            client: {
                browser: 'Chrome',
                browserVersion: '120',
                os: 'Android',
                osVersion: '14',
                deviceType: 'mobile',
                deviceModel: 'Pixel 8',
                language: 'en-NG',
                clientHints: {}
            }
        });
        mocks.recordAnonymousAuditLookup.mockResolvedValue(true);
    });

    it('sends the complete forensic report to creator DM only when invoked in a group', async () => {
        const sock = { sendMessage: vi.fn().mockResolvedValue({}) };
        await anontrace.handler(sock, makeMessage(), ['msg-123'], {
            chatId: groupJid,
            senderId: creatorJid
        });

        expect(mocks.getAnonymousSubmissionRecord).toHaveBeenCalledWith('msg-123');
        expect(mocks.recordAnonymousAuditLookup).toHaveBeenCalledWith({
            actorId: creatorJid,
            reference: 'msg-123',
            found: true
        });
        expect(sock.sendMessage).toHaveBeenCalledTimes(1);
        expect(sock.sendMessage.mock.calls[0][0]).toBe(creatorJid);
        expect(sock.sendMessage.mock.calls[0][1].text).toContain('Public IP: 203.0.113.10');
        expect(sock.sendMessage.mock.calls[0][1].text).toContain('Device model: Pixel 8');
        expect(sock.sendMessage.mock.calls[0][0]).not.toBe(groupJid);
    });

    it('sends not-found and usage responses to creator DM, never the group', async () => {
        const sock = { sendMessage: vi.fn().mockResolvedValue({}) };
        mocks.getAnonymousSubmissionRecord.mockResolvedValueOnce(null);
        await anontrace.handler(sock, makeMessage(), ['old-message-id'], {
            chatId: groupJid,
            senderId: creatorJid
        });
        expect(sock.sendMessage.mock.calls[0][0]).toBe(creatorJid);
        expect(sock.sendMessage.mock.calls[0][1].text).toContain('No forensic record was found');

        sock.sendMessage.mockClear();
        await anontrace.handler(sock, makeMessage(), [], {
            chatId: groupJid,
            senderId: creatorJid
        });
        expect(sock.sendMessage.mock.calls[0][0]).toBe(creatorJid);
        expect(sock.sendMessage.mock.calls[0][1].text).toContain('Usage: .anontrace');
    });

    it('does not disclose any forensic record to a non-creator', async () => {
        const sock = { sendMessage: vi.fn().mockResolvedValue({}) };
        mocks.isOwnerOnly.mockReturnValue(false);
        await anontrace.handler(sock, makeMessage({
            key: { remoteJid: groupJid, participant: '2348000000000@s.whatsapp.net' }
        }), ['msg-123'], {
            chatId: groupJid,
            senderId: '2348000000000@s.whatsapp.net'
        });

        expect(mocks.getAnonymousSubmissionRecord).not.toHaveBeenCalled();
        expect(sock.sendMessage).toHaveBeenCalledTimes(1);
        expect(sock.sendMessage.mock.calls[0][0]).toBe(groupJid);
        expect(sock.sendMessage.mock.calls[0][1].text).not.toContain('203.0.113.10');
    });
});
