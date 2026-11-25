import axios from 'axios';
import store from '../lib/lightweight_store.js';

const STATUS_KEY = 'renderRemoteRestartStatus_v1';
const REQUEST_COOLDOWN_MS = 10 * 60 * 1000;
let lastRequestAt = 0;

export default {
    command: 'restart',
    aliases: ['rebootbot', 'botrestart'],
    category: 'owner',
    description: 'Restart the Render-hosted Forge Guard service',
    usage: '.restart | .restart status',
    strictOwnerOnly: true,
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const quoted = { quoted: message };
        if (String(args[0] || '').toLowerCase() === 'status') {
            const status = await store.getSetting('global', STATUS_KEY);
            if (!status) return sock.sendMessage(chatId, { text: 'No remote restart request has been recorded.' }, quoted);
            const requested = new Date(status.requestedAt).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' });
            const completed = status.completedAt ? '\\nCompleted: ' + new Date(status.completedAt).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }) : '';
            return sock.sendMessage(chatId, { text: '*RENDER RESTART STATUS*\\nState: *' + status.state + '*\\nRequested: ' + requested + completed + (status.detail ? '\\nDetails: ' + status.detail : '') }, quoted);
        }
        const apiKey = String(process.env.RENDER_API_KEY || '').trim();
        const serviceId = String(process.env.RENDER_SERVICE_ID || '').trim();
        if (!apiKey || !serviceId) return sock.sendMessage(chatId, { text: 'Remote restart is not configured yet. Add RENDER_API_KEY and RENDER_SERVICE_ID to the Forge Guard Render environment, then redeploy.' }, quoted);
        if (Date.now() - lastRequestAt < REQUEST_COOLDOWN_MS) return sock.sendMessage(chatId, { text: 'A remote restart was requested recently. Use .restart status before requesting another.' }, quoted);
        lastRequestAt = Date.now();
        const requestedAt = Date.now();
        await store.saveSettingVerified('global', STATUS_KEY, { state: 'requesting', requestedAt, requestedBy: context.senderId || 'creator' });
        try {
            await axios.post('https://api.render.com/v1/services/' + encodeURIComponent(serviceId) + '/restart', null, {
                timeout: 12000,
                headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json' }
            });
            await store.saveSettingVerified('global', STATUS_KEY, { state: 'accepted', requestedAt, completedAt: Date.now(), detail: 'Render accepted the restart request.' });
            await sock.sendMessage(chatId, { text: '♻️ Render accepted the Forge Guard restart request. The bot may disconnect briefly while the new instance starts. Use .restart status to check the recorded request.' }, quoted);
        } catch (error) {
            const statusCode = error?.response?.status;
            const detail = statusCode ? 'Render API returned HTTP ' + statusCode : String(error?.code || error?.message || 'request failed').slice(0, 120);
            await store.saveSettingVerified('global', STATUS_KEY, { state: 'failed', requestedAt, completedAt: Date.now(), detail });
            await sock.sendMessage(chatId, { text: '❌ Render did not confirm the restart. ' + detail + '. Check the API key permissions and service ID.' }, quoted);
        }
    }
};
