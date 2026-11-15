import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export function patchMessagesSend(source) {
    const oldCall = 'await assertSessions(lids, true)';
    if (source.includes(oldCall)) {
        return { source: source.replace(oldCall, 'await assertSessions(lids)'), changed: true };
    }
    if (source.includes('await assertSessions(lids)')) {
        return { source, changed: false };
    }
    throw new Error('Baileys LID session-refresh call was not found; refusing an unsafe partial patch.');
}

export function patchMessagesReceive(source) {
    let changed = false;
    const retryCall = /await sendRetryRequest\(node,\s*!encNode\)/;
    if (retryCall.test(source)) {
        source = source.replace(retryCall, 'await sendRetryRequest(node, true)');
        changed = true;
    } else if (!/await sendRetryRequest\(node,\s*true\)/.test(source)) {
        throw new Error('Baileys decrypt-retry call was not found; refusing an unsafe partial patch.');
    }

    const retryHandlerStart = source.indexOf('const sendRetryRequest = async');
    if (retryHandlerStart < 0) {
        throw new Error('Baileys sendRetryRequest handler was not found.');
    }
    const before = source.slice(0, retryHandlerStart);
    let handler = source.slice(retryHandlerStart);
    const oldSender = /const fromJid = node\.attrs\.from;?/;
    const participantSender = 'const fromJid = node.attrs.participant || node.attrs.from;';
    const mappedParticipantSender = `let fromJid = node.attrs.participant || node.attrs.from;
\t\tif (node.attrs.participant && fromJid.endsWith('@s.whatsapp.net')) {
\t\t\ttry {
\t\t\t\tconst mappedLid = await signalRepository.lidMapping.getLIDForPN(jidNormalizedUser(fromJid));
\t\t\t\tif (mappedLid) fromJid = mappedLid;
\t\t\t} catch {
\t\t\t\t// Keep the participant PN when no local LID mapping is available.
\t\t\t}
\t\t}`;
    if (oldSender.test(handler)) {
        handler = handler.replace(oldSender, mappedParticipantSender);
        changed = true;
    } else if (handler.includes(participantSender)) {
        handler = handler.replace(participantSender, mappedParticipantSender);
        changed = true;
    } else if (!handler.includes("let fromJid = node.attrs.participant || node.attrs.from;")) {
        throw new Error('Baileys retry sender-JID selection was not found; refusing an unsafe partial patch.');
    }

    return { source: before + handler, changed };
}

function resolveBaileysSocketFile(filename) {
    const require = createRequire(import.meta.url);
    const entry = require.resolve('@whiskeysockets/baileys');
    const libraryDirectory = path.dirname(entry);
    const candidates = [
        path.join(libraryDirectory, 'Socket', filename),
        path.join(libraryDirectory, 'socket', filename)
    ];
    const found = candidates.find(candidate => fs.existsSync(candidate));
    if (!found) {
        throw new Error('Could not locate Baileys Socket/' + filename + ' beside ' + entry);
    }
    return found;
}

export function applyBaileysLidSessionPatches() {
    const sendPath = resolveBaileysSocketFile('messages-send.js');
    const receivePath = resolveBaileysSocketFile('messages-recv.js');
    const sendResult = patchMessagesSend(fs.readFileSync(sendPath, 'utf8'));
    const receiveResult = patchMessagesReceive(fs.readFileSync(receivePath, 'utf8'));

    if (sendResult.changed) fs.writeFileSync(sendPath, sendResult.source);
    if (receiveResult.changed) fs.writeFileSync(receivePath, receiveResult.source);

    console.log(
        '[Baileys compatibility] LID session churn guard=' + (sendResult.changed ? 'patched' : 'already patched') +
        '; first-retry key recovery=' + (receiveResult.changed ? 'patched' : 'already patched')
    );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    applyBaileysLidSessionPatches();
}
