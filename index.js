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
import { restoreSessionFromMongo, backupSessionToMongo, isMongoBackupEnabled, clearMongoSessionBackup, claimSessionBackupLeadership, getAuthStateInventory } from './lib/sessionBackup.js';
import { server, PORT } from './lib/server.js';
import { printLog } from './lib/print.js';
import { writeErrorLog } from './lib/logger.js';
import { handleMessages, handleGroupParticipantUpdate, handleStatus, handleCall } from './lib/messageHandler.js';
import commandHandler from './lib/commandHandler.js';
import { startSchedulerEngine, trackGroup } from './plugins/schedule.js';
import { FEATURE_GROUPS } from './lib/featureGroups.js';

import { installSignalDiagnosticGuard } from './lib/signalDiagnostics.js';
import { parseGroupSenderKeyRecoveryTargets, resetGroupSenderKeyMemoryBeforeSend } from './lib/groupSenderKeyRecovery.js';
import { createPerChatMessageQueue } from './lib/perChatMessageQueue.js';
import { installNetworkDiagnostics } from './lib/networkDiagnostics.js';

// Keep libsignal diagnostics useful without allowing serialized ratchets or key material into logs.
installSignalDiagnosticGuard();
// Attribute outbound TCP/TLS payload bytes by destination without logging payloads or URLs.
installNetworkDiagnostics();
global.__forgeWhatsAppConnected = false;

const queueOverflowNoticeAt = new Map();
const incomingMessageQueue = createPerChatMessageQueue({
    maxConcurrentChats: 4,
    maxQueuePerChat: 150,
    maxQueueTotal: 800,