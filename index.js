import 'dotenv/config';

import fs, { existsSync, mkdirSync, rmSync } from 'fs';
import path, { dirname } from 'path';
import chalk from 'chalk';
import syntaxerror from 'syntax-error';
import { parsePhoneNumber as PhoneNumber } from 'awesome-phonenumber';
import readline from 'readline';
import QRCode from 'qrcode';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { smsg } from './lib/myfunc.js';
import { compileAll } from './lib/compile.js';
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers, jidDecode, jidNormalizedUser, makeCacheableSignalKeyStore, delay } from '@whiskeysockets/baileys';
import NodeCache from 'node-cache';
import pino from 'pino';
import config from './config.js';
import store from './lib/lightweight_store.js';
import SaveCreds from './lib/session.js';
import { restoreSessionFromMongo, backupSessionToMongo, isMongoBackupEnabled, clearMongoSessionBackup } from './lib/sessionBackup.js';
import { server, PORT } from './lib/server.js';
import { printLog } from './lib/print.js';
import { writeErrorLog } from './lib/logger.js';
import { handleMessages, handleGroupParticipantUpdate, handleStatus, handleCall } from './lib/messageHandler.js';
import commandHandler from './lib/commandHandler.js';
store.readFromFile();
setInterval(() => store.writeToFile(), config.storeWriteInterval || 10000);
setInterval(() => {
    if (global.gc) {
        global.gc();
        console.log('🧹 Garbage collection completed');
    }
}, 60000);
setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024;
    if (used > 400) {
        printLog('warning', 'RAM too high (>400MB), restarting bot...');
        process.exit(1);
    }
}, 30000);
const phoneNumber = config.pairingNumber || config.ownerNumber || "923051391005";
// Auto-create data directory and default files on startup
const DATA_DEFAULTS = {
    'owner.json': [],
    'banned.json': [],
    'premium.json': [],
    'warnings.json': {},
    'notes.json': {},
    'autoAi.json': {},
    'messageCount.json': { isPublic: true, messageCount: {} },
    'userGroupData.json': { users: [], groups: [], antilink: {}, antibadword: {}, warnings: {}, sudo: [], welcome: {}, goodbye: {}, chatbot: {}, autoReaction: false },
    'autoStatus.json': { enabled: false },
    'autoread.json': { enabled: false },
    'autotyping.json': { enabled: false },
    'pmblocker.json': { enabled: false },
    'anticall.json': { enabled: false },
    'stealthMode.json': { enabled: false },
    'autoBio.json': { enabled: false, customBio: null },
    'autoReaction.json': { enabled: false },
    'antidelete.json': { enabled: false },
    'antilink.json': {},
    'antibadword.json': {},
};
fs.mkdirSync('./data', { recursive: true });
for (const [file, def] of Object.entries(DATA_DEFAULTS)) {
    const fp = `./data/${file}`;
    if (!fs.existsSync(fp))
        fs.writeFileSync(fp, JSON.stringify(def, null, 2));
}
let owner = [];
try {
    owner = JSON.parse(fs.readFileSync('./data/owner.json', 'utf-8'));
}
catch {
    owner = [];
}
global.botname = config.botName || "MEGA-MD";
global.themeemoji = "•";
const pairingCode = !process.argv.includes("--qr-code");
const useMobile = process.argv.includes("--mobile");
let rl = null;
let rlClosed = false;
if (process.stdin.isTTY && !config.pairingNumber) {
    rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.on('close', () => { rlClosed = true; });
}
const question = (text) => {
    if (rl && !rlClosed) {
        return new Promise((resolve) => rl.question(text, resolve));
    }
    else {
        return Promise.resolve(config.ownerNumber || phoneNumber);
    }
};
process.on('exit', () => {
    if (rl && !rlClosed)
        rl.close();
});
process.on('SIGINT', () => {
    if (rl && !rlClosed)
        rl.close();
    process.exit(0);
});
// --- Reconnect/pairing-storm guard -----------------------------------
// startQasimDev() used to be called directly from 5 different places
// (the pairing-retry handler, the connection-close handler's two
// branches, this function's own catch block, and main()) with no
// coordination. Any disconnect - including a transient one that isn't a
// real logout - could fire a brand-new startQasimDev() while the
// previous socket/connection was still alive, creating overlapping
// WhatsApp Web connections on the same device credentials. WhatsApp
// detects that as abuse and force-logs-out (401), which this code then
// "handled" by wiping the session and immediately requesting a new
// pairing code - and because multiple instances could be racing, that
// wipe-and-repair could cascade into a runaway loop generating a new
// pairing code every few seconds.
//
// isConnecting prevents two startQasimDev() calls from running at the
// same time. scheduleReconnect() debounces the close-handler/catch
// retries so a burst of close events only schedules one reconnect, not
// one per event.
let isConnecting = false;
let reconnectTimer = null;
async function safeStartQasimDev() {
    if (isConnecting) {
        printLog('warning', 'startQasimDev() already in progress - skipping duplicate call.');
        return;
    }
    isConnecting = true;
    try {
        await startQasimDev();
    }
    finally {
        isConnecting = false;
    }
}
function scheduleReconnect(delayMs, { wipeSession = false, reason = '' } = {}) {
    if (reconnectTimer) {
        printLog('warning', `Reconnect already scheduled - ignoring duplicate request (${reason}).`);
        return;
    }
    printLog('connection', `Reconnecting in ${Math.round(delayMs / 1000)} seconds...${reason ? ` (${reason})` : ''}`);
    reconnectTimer = setTimeout(async () => {
        reconnectTimer = null;
        if (wipeSession) {
            try {
                rmSync('./session', { recursive: true, force: true });
            }
            catch (_e) { /* ignore */ }
        }
        await safeStartQasimDev();
    }, delayMs);
}

// --- Zombie-connection watchdog ---------------------------------------
// Keeping the Render process alive (via an uptime pinger) and having a
// healthy WhatsApp *socket* are two different things. Baileys doesn't
// always emit a 'close' event when the underlying connection goes
// stale/half-open (e.g. a network blip on WhatsApp's side) - the process
// keeps running, nothing crashes, but the bot stops receiving or sending
// messages until something forces a fresh connection. This watchdog
// periodically does a cheap, real round-trip to WhatsApp's servers
// (a presence update) with a timeout; if it fails or times out, it ends
// the current socket, which triggers the normal (now deduped) close
// handler to reconnect automatically - no manual Render restart needed.
let currentSocket = null;
let watchdogTimer = null;
const WATCHDOG_INTERVAL_MS = 3 * 60 * 1000; // probe every 3 minutes
const WATCHDOG_PROBE_TIMEOUT_MS = 15 * 1000; // give the probe 15s to respond
function startWatchdog() {
    if (watchdogTimer)
        return;
    watchdogTimer = setInterval(async () => {
        if (!currentSocket || isConnecting || reconnectTimer)
            return; // nothing to probe, or a (re)connect is already underway
        try {
            await Promise.race([
                currentSocket.sendPresenceUpdate('available'),
                new Promise((_resolve, reject) => setTimeout(() => reject(new Error('watchdog probe timed out')), WATCHDOG_PROBE_TIMEOUT_MS)),
            ]);
        }
        catch (err) {
            printLog('warning', `Watchdog: connection looks dead (${err.message}) - forcing reconnect.`);
            const dead = currentSocket;
            currentSocket = null;
            try {
                dead.end(new Error('watchdog: stale connection'));
            }
            catch (_e) {
                // .end() itself failed (socket already half-dead) - the close
                // handler won't fire in this case, so schedule directly.
                scheduleReconnect(5000, { wipeSession: false, reason: 'watchdog forced reconnect' });
            }
        }
    }, WATCHDOG_INTERVAL_MS);
}
// Periodically uploads the full ./session folder to MongoDB (when
// MONGO_URL is configured) so pre-keys and per-contact Signal sessions
// survive a redeploy, not just the long-term identity in creds.json.
let sessionBackupTimer = null;
const SESSION_BACKUP_INTERVAL_MS = 8 * 1000;
function startSessionBackupLoop() {
    if (!isMongoBackupEnabled())
        return;
    if (sessionBackupTimer)
        return;
    backupSessionToMongo().catch(() => { }); // immediate snapshot, don't wait for the first tick
    sessionBackupTimer = setInterval(() => {
        backupSessionToMongo().catch(() => { });
    }, SESSION_BACKUP_INTERVAL_MS);
}
function ensureSessionDirectory() {
    const sessionPath = path.join(__dirname, 'session');
    if (!existsSync(sessionPath)) {
        mkdirSync(sessionPath, { recursive: true });
    }
    return sessionPath;
}
function hasValidSession() {
    try {
        const credsPath = path.join(__dirname, 'session', 'creds.json');
        if (!existsSync(credsPath))
            return false;
        const fileContent = fs.readFileSync(credsPath, 'utf8');
        if (!fileContent || fileContent.trim().length === 0) {
            printLog('warning', 'creds.json exists but is empty');
            return false;
        }
        try {
            const creds = JSON.parse(fileContent);
            if (!creds.noiseKey || !creds.signedIdentityKey || !creds.signedPreKey) {
                printLog('warning', 'creds.json is missing required fields');
                return false;
            }
            if (creds.registered === false) {
                printLog('warning', 'Session not registered. Clearing for fresh pairing...');
                try {
                    rmSync(path.join(__dirname, 'session'), { recursive: true, force: true });
                }
                catch (_e) { /* ignore */ }
                return false;
            }
            printLog('success', 'Valid and registered session credentials found');
            return true;
        }
        catch (_parseError) {
            printLog('warning', 'creds.json contains invalid JSON');
            return false;
        }
    }
    catch (error) {
        printLog('error', `Error checking session validity: ${error.message}`);
        return false;
    }
}
async function initializeSession() {
    ensureSessionDirectory();
    // IMPORTANT: only restore from MongoDB if we don't already have a
    // valid, registered session on local disk. initializeSession() runs
    // on every startQasimDev() call - which includes every reconnect
    // (a transient "connection closed (408)", the 3-minute watchdog
    // probe, etc.), not just a fresh container boot after a redeploy.
    // Restoring unconditionally on every reconnect was stomping the
    // local ./session files (which Baileys keeps advancing live, e.g.
    // per-contact Signal ratchets) with whatever snapshot MongoDB last
    // had - up to several seconds stale - every single time the socket
    // blipped. That rollback is exactly what causes "Failed to decrypt
    // message with any known session... Bad MAC" floods, and it was
    // happening far more often than real process restarts (confirmed in
    // production logs on 2026-10-29: a fresh "Restored full session
    // state from MongoDB" line every 10-20 minutes on the same running
    // instance, each one followed by a Bad MAC flood).
    //
    // Mongo is now only consulted when the local session is missing or
    // invalid (a genuinely fresh container), which is the only case it
    // was ever meant to cover.
    if (isMongoBackupEnabled() && !hasValidSession()) {
        const restored = await restoreSessionFromMongo();
        if (restored && hasValidSession()) {
            printLog('success', 'Restored full session state from MongoDB - no pairing needed.');
            return true;
        }
    }
    const txt = config.sessionId;
    if (!txt) {
        if (hasValidSession()) {
            printLog('success', 'Existing session found. Using saved credentials');
            return true;
        }
        return false;
    }
    if (hasValidSession())
        return true;
    try {
        await SaveCreds(txt);
        await delay(2000);
        if (hasValidSession()) {
            printLog('success', 'Session file verified and valid');
            await delay(1000);
            return true;
        }
        else {
            printLog('error', 'Session file not valid after download');
            return false;
        }
    }
    catch (error) {
        printLog('error', `Error downloading session: ${error.message}`);
        return false;
    }
}
server.listen(PORT, () => {
    printLog('success', `Server listening on port ${PORT}`);
});
async function startQasimDev() {
    try {
        const { version } = await fetchLatestBaileysVersion();
        ensureSessionDirectory();
        await delay(1000);
        const { state, saveCreds } = await useMultiFileAuthState(`./session`);
        const _saveCreds = async () => {
            ensureSessionDirectory();
            await saveCreds();
            // Credentials changed - back up immediately rather than waiting
            // for the periodic loop, since this is the highest-value moment
            // to capture (e.g. right after pairing).
            backupSessionToMongo().catch(() => { });
        };
        const msgRetryCounterCache = new NodeCache();
        const ghostMode = await store.getSetting('global', 'stealthMode');
        const isGhostActive = ghostMode && ghostMode.enabled;
        const QasimDev = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS('Chrome'),
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: !isGhostActive,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            getMessage: async (key) => {
                const jid = jidNormalizedUser(key.remoteJid);
                const msg = await store.loadMessage(jid, key.id);
                return msg?.message || "";
            },
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
        });
        QasimDev.store = store;
        const originalSendPresenceUpdate = QasimDev.sendPresenceUpdate;
        const originalReadMessages = QasimDev.readMessages;
        const originalSendReceipt = QasimDev.sendReceipt;
        QasimDev.sendPresenceUpdate = async function (...args) {
            const ghostMode = await store.getSetting('global', 'stealthMode');
            if (ghostMode && ghostMode.enabled) {
                printLog('info', '👻 Blocked presence update (stealth mode)');
                return;
            }
            return originalSendPresenceUpdate.apply(this, args);
        };
        QasimDev.readMessages = async function (...args) {
            const ghostMode = await store.getSetting('global', 'stealthMode');
            if (ghostMode && ghostMode.enabled)
                return;
            return originalReadMessages.apply(this, args);
        };
        if (originalSendReceipt) {
            QasimDev.sendReceipt = async function (...args) {
                const ghostMode = await store.getSetting('global', 'stealthMode');
                if (ghostMode && ghostMode.enabled)
                    return;
                return originalSendReceipt.apply(this, args);
            };
        }
        const originalQuery = QasimDev.query;
        QasimDev.query = async function (node, ...args) {
            const ghostMode = await store.getSetting('global', 'stealthMode');
            if (ghostMode && ghostMode.enabled) {
                if (node && node.tag === 'receipt')
                    return;
                if (node && node.attrs && (node.attrs.type === 'read' || node.attrs.type === 'read-self'))
                    return;
            }
            return originalQuery.apply(this, [node, ...args]);
        };
        QasimDev.isGhostMode = async () => {
            const ghostMode = await store.getSetting('global', 'stealthMode');
            return ghostMode && ghostMode.enabled;
        };
        QasimDev.ev.on('creds.update', _saveCreds);
        store.bind(QasimDev.ev);
        QasimDev.ev.on('messages.upsert', async (chatUpdate) => {
            try {
                const mek = chatUpdate.messages[0];
                if (!mek.message)
                    return;
                mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage')
                    ? mek.message.ephemeralMessage.message
                    : mek.message;
                if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                    await handleStatus(QasimDev, chatUpdate);
                    return;
                }
                if (!QasimDev.public && !mek.key.fromMe && chatUpdate.type === 'notify') {
                    const isGroup = mek.key?.remoteJid?.endsWith('@g.us');
                    if (!isGroup)
                        return;
                }
                if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16)
                    return;
                if (QasimDev?.msgRetryCounterCache) {
                    QasimDev.msgRetryCounterCache.clear();
                }
                try {
                    await handleMessages(QasimDev, chatUpdate);
                }
                catch (err) {
                    printLog('error', `Error in handleMessages: ${err.message}`);
                    if (mek.key && mek.key.remoteJid) {
                        await QasimDev.sendMessage(mek.key.remoteJid, {
                            text: '❌ An error occurred while processing your message.',
                            contextInfo: {
                                forwardingScore: 1,
                                isForwarded: true,
                                forwardedNewsletterMessageInfo: {
                                    newsletterJid: '120363319098372999@newsletter',
                                    newsletterName: 'GlobalTechInc',
                                    serverMessageId: -1
                                }
                            }
                        }).catch(console.error);
                    }
                }
            }
            catch (err) {
                printLog('error', `Error in messages.upsert: ${err.message}`);
            }
        });
        QasimDev.decodeJid = (jid) => {
            if (!jid)
                return jid;
            if (/:\d+@/gi.test(jid)) {
                const decode = jidDecode(jid) || {};
                return decode.user && decode.server && `${decode.user }@${ decode.server}` || jid;
            }
            else
                return jid;
        };
        QasimDev.ev.on('contacts.update', (update) => {
            for (const contact of update) {
                const id = QasimDev.decodeJid(contact.id);
                if (store && store.contacts)
                    store.contacts[id] = { id, name: contact.notify };
            }
        });
        QasimDev.getName = (jid, withoutContact = false) => {
            const id = QasimDev.decodeJid(jid);
            withoutContact = QasimDev.withoutContact || withoutContact;
            let v;
            if (id.endsWith("@g.us"))
                return new Promise(async (resolve) => {
                    v = store.contacts[id] || {};
                    if (!(v.name || v.subject))
                        v = QasimDev.groupMetadata(id) || {};
                    resolve(v.name || v.subject || PhoneNumber(`+${ id.replace('@s.whatsapp.net', '')}`).number?.international);
                });
            else
                v = id === '0@s.whatsapp.net' ? {
                    id,
                    name: 'WhatsApp'
                } : id === QasimDev.decodeJid(QasimDev.user.id) ?
                    QasimDev.user :
                    (store.contacts[id] || {});
            return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber(`+${ jid.replace('@s.whatsapp.net', '')}`).number?.international;
        };
        QasimDev.public = true;
        QasimDev.serializeM = (m) => smsg(QasimDev, m, store);
        const isRegistered = state.creds?.registered === true;
        if (pairingCode && !isRegistered) {
            if (useMobile)
                throw new Error('Cannot use pairing code with mobile api');
            let phoneNumberInput;
            if (config.pairingNumber) {
                phoneNumberInput = config.pairingNumber;
            }
            else if (process.env.PAIRING_NUMBER) {
                phoneNumberInput = process.env.PAIRING_NUMBER;
            }
            else if (rl && !rlClosed) {
                phoneNumberInput = await question(chalk.bgBlack(chalk.greenBright(`Please type your WhatsApp number 😍\nFormat: 923001234567 (without + or spaces) : `)));
            }
            else {
                phoneNumberInput = phoneNumber;
                printLog('info', `Using default phone number: ${phoneNumberInput}`);
            }
            phoneNumberInput = phoneNumberInput.replace(/[^0-9]/g, '');
            const pn = PhoneNumber(`+${ phoneNumberInput}`);
            if (!pn.valid) {
                printLog('error', 'Invalid phone number format');
                if (rl && !rlClosed)
                    rl.close();
                process.exit(1);
            }
            const doPairing = async (num, attempt = 1) => {
                try {
                    let code = await QasimDev.requestPairingCode(num);
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    console.log(chalk.black(chalk.bgGreen(`Your Pairing Code : `)), chalk.black(chalk.white(code)));
                    printLog('success', `Pairing code generated: ${code}`);
                    if (rl && !rlClosed) {
                        rl.close();
                        rl = null;
                    }
                }
                catch (error) {
                    if (attempt < 3) {
                        scheduleReconnect(3000, { wipeSession: true, reason: 'pairing code request failed' });
                    }
                    else {
                        printLog('error', 'All 3 pairing attempts failed. Please restart manually.');
                    }
                }
            };
            setTimeout(() => doPairing(phoneNumberInput), 3000);
        }
        else if (isRegistered) {
            if (rl && !rlClosed) {
                rl.close();
                rl = null;
            }
        }
        else {
            printLog('warning', 'Waiting for connection to establish...');
            if (rl && !rlClosed) {
                rl.close();
                rl = null;
            }
        }
        QasimDev.ev.on('connection.update', async (s) => {
            const { connection, lastDisconnect, qr } = s;
            if (qr) {
                if (!pairingCode) {
                    try {
                        console.log(await QRCode.toString(qr, { type: 'terminal', small: true }));
                    }
                    catch (_e) {
                        console.log('QR:', qr);
                    }
                }
            }
            if (connection === "open") {
                printLog('success', 'Bot connected successfully!');
                currentSocket = QasimDev;
                startWatchdog();
                startSessionBackupLoop();
                try {
                    const setbioModule = await import('./plugins/setbio.js');
                    const startAutoBio = setbioModule.startAutoBio || setbioModule.default?.startAutoBio;
                    if (typeof startAutoBio === 'function')
                        startAutoBio(QasimDev);
                }
                catch (e) {
                    printLog('error', `Failed to start auto bio: ${e.message}`);
                }
                const ghostMode = await store.getSetting('global', 'stealthMode');
                if (ghostMode && ghostMode.enabled) {
                    printLog('info', '👻 STEALTH MODE ACTIVE');
                }
                printLog('success', `Connected to => ${ JSON.stringify(QasimDev.user, null, 2)}`);
                try {
                    const botNumber = `${QasimDev.user.id.split(':')[0] }@s.whatsapp.net`;
                    const ghostStatus = (ghostMode && ghostMode.enabled) ? '\n👻 Stealth Mode: ACTIVE' : '';
                    await QasimDev.sendMessage(botNumber, {
                        text: `🤖 Bot Connected Successfully!\n\n⏰ Time: ${new Date().toLocaleString()}\n✅ Status: Online and Ready!${ghostStatus}\n\n✅Make sure to join below channel`,
                        contextInfo: {
                            forwardingScore: 1,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: '120363319098372999@newsletter',
                                newsletterName: 'GlobalTechInc',
                                serverMessageId: -1
                            }
                        }
                    });
                }
                catch (error) {
                    printLog('error', `Failed to send connection message: ${error.message}`);
                }
                await delay(1999);
                try {
                    owner = JSON.parse(fs.readFileSync('./data/owner.json', 'utf-8'));
                }
                catch (_e) { }
                printLog('info', `[ ${config.botName || 'MEGA-MD'} ]`);
                printLog('info', `WA NUMBER  : ${owner[0] || config.ownerNumber || ''}`);
                printLog('success', `Bot Connected Successfully!`);
                printLog('info', `Plugins   : ${commandHandler.commands.size}`);
                printLog('info', `Prefixes   : ${config.prefixes.join(', ')}`);
                printLog('store', `Backend    : ${store.getStats().backend}`);
                console.log();
            }
            if (connection === 'close') {
                if (currentSocket === QasimDev)
                    currentSocket = null;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 401;
                if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                    scheduleReconnect(3000, { wipeSession: true, reason: `logged out (status ${statusCode})` });
                    return;
                }
                if (shouldReconnect) {
                    scheduleReconnect(5000, { wipeSession: false, reason: `connection closed (status ${statusCode})` });
                }
            }
        });
        QasimDev.ev.on('call', async (calls) => {
            await handleCall(QasimDev, calls);
        });
        QasimDev.ev.on('group-participants.update', async (update) => {
            await handleGroupParticipantUpdate(QasimDev, update);
        });
        QasimDev.ev.on('status.update', async (status) => {
            await handleStatus(QasimDev, status);
        });
        QasimDev.ev.on('messages.reaction', async (reaction) => {
            await handleStatus(QasimDev, reaction);
        });
        return QasimDev;
    }
    catch (error) {
        printLog('error', `Error in startQasimDev: ${error.message}`);
        if (rl && !rlClosed) {
            rl.close();
            rl = null;
        }
        scheduleReconnect(5000, { wipeSession: false, reason: `startQasimDev error: ${error.message}` });
    }
}
async function main() {
    await compileAll();
    await commandHandler.loadCommands();
    printLog('info', 'Starting MEGA MD BOT...');
    // One-shot escape hatch: set FORCE_RELINK=true in the environment to
    // wipe the local session AND the MongoDB backup before pairing, so a
    // deliberate fresh relink isn't immediately undone by restoring the
    // old (possibly Signal-session-desynced) state back. Remove the env
    // var again after the new pairing succeeds, or every future boot will
    // keep wiping and re-pairing.
    if (process.env.FORCE_RELINK === 'true') {
        printLog('warning', 'FORCE_RELINK=true - wiping local session and MongoDB backup for a fresh pairing...');
        try {
            rmSync('./session', { recursive: true, force: true });
        }
        catch (_e) { /* ignore */ }
        if (isMongoBackupEnabled()) {
            await clearMongoSessionBackup();
        }
    }
    await initializeSession();
    await delay(3000);
    safeStartQasimDev().catch((error) => {
        printLog('error', `Fatal error: ${error.message}`);
        if (rl && !rlClosed)
            rl.close();
        process.exit(1);
    });
}
main();
// Session cleanup interval
const sessionDir = path.join(process.cwd(), 'session');
setInterval(() => {
    if (!fs.existsSync(sessionDir))
        return;
    fs.readdir(sessionDir, (err, files) => {
        if (err)
            return;
        for (const file of files) {
            if (file === 'creds.json')
                continue;
            if (file.startsWith('app-state-sync-key-'))
                continue;
            fs.unlink(path.join(sessionDir, file), () => { });
        }
    });
}, 3 * 60 * 1000);
// Temp folder setup
const customTemp = path.join(process.cwd(), 'temp');
if (!fs.existsSync(customTemp))
    fs.mkdirSync(customTemp, { recursive: true });
process.env.TMPDIR = customTemp;
process.env.TEMP = customTemp;
process.env.TMP = customTemp;
// Temp folder cleanup
setInterval(() => {
    fs.readdir(customTemp, (err, files) => {
        if (err)
            return;
        for (const file of files) {
            const filePath = path.join(customTemp, file);
            fs.stat(filePath, (err, stats) => {
                if (!err && Date.now() - stats.mtimeMs > 3 * 60 * 60 * 1000) {
                    fs.unlink(filePath, () => { });
                }
            });
        }
    });
}, 1 * 60 * 60 * 1000);
// Syntax check dist files
const folders = [
    path.join(__dirname, './lib'),
    path.join(__dirname, './plugins')
];
folders.forEach(folder => {
    if (!fs.existsSync(folder))
        return;
    fs.readdirSync(folder)
        .filter(file => file.endsWith('.js'))
        .forEach(file => {
        const filePath = path.join(folder, file);
        try {
            const code = fs.readFileSync(filePath, 'utf-8');
            const err = syntaxerror(code, file, {
                sourceType: 'module',
                allowAwaitOutsideFunction: true
            });
            if (err) {
                console.error(chalk.red(`❌ Syntax error in ${filePath}:\n${err}`));
            }
        }
        catch (e) {
            console.error(chalk.yellow(`⚠️ Cannot read file ${filePath}:\n${e}`));
        }
    });
});
// Error handlers
process.on('uncaughtException', (err) => {
    printLog('error', `Uncaught Exception: ${err.message}`);
    console.error(err.stack);
    writeErrorLog({
        type: 'uncaughtException',
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
    });
});
process.on('unhandledRejection', (err) => {
    printLog('error', `Unhandled Rejection: ${err.message}`);
    console.error(err.stack);
    writeErrorLog({
        type: 'unhandledRejection',
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
    });
});
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        printLog('error', `Address localhost:${PORT} in use`);
        writeErrorLog({
            type: 'serverError',
            error: `Address localhost:${PORT} in use`,
            timestamp: new Date().toISOString()
        });
        server.close();
    }
    else {
        printLog('error', `Server error: ${error.message}`);
        writeErrorLog({
            type: 'serverError',
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    }
});
