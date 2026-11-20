import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export function patchMessagesSend(source) {
    const marker = '[ForgeGuard] refresh sessions only for newly mapped LIDs';
    if (source.includes(marker)) return { source, changed: false };

    const storeCall = 'await signalRepository.lidMapping.storeLIDPNMappings(lidResults.map(a => ({ lid: a.lid, pn: a.id })))';
    if (!source.includes(storeCall)) {
        if (source.includes('const stored = await signalRepository.lidMapping.storeLIDPNMappings(')) {
            throw new Error('Baileys LID mapping refresh block is partially patched; refusing an unsafe partial patch.');
        }
        throw new Error('Baileys LID mapping store call was not found; refusing an unsafe partial patch.');
    }

    source = source.replace(
        storeCall,
        'const stored = await signalRepository.lidMapping.storeLIDPNMappings(lidResults.map(a => ({ lid: a.lid, pn: a.id })))'
    );

    const refreshBlock = /try\\s*\\{\\s*const lids = lidResults\\.map\\(a => a\\.lid\\)\\s*;?\\s*if\\s*\\(lids\\.length\\)\\s*\\{\\s*await assertSessions\\(lids(?:,\\s*true)?\\)\\s*;?\\s*\\}\\s*\\}\\s*catch\\s*\\((\\w+)\\)\\s*\\{\\s*logger\\.warn\\(\\{\\s*\\1,\\s*count:\\s*lidResults\\.length\\s*\\},\\s*(['"])failed to assert sessions for newly mapped LIDs\\2\\)\\s*;?\\s*\\}/;
    if (!refreshBlock.test(source)) {
        throw new Error('Baileys LID session-refresh block was not found; refusing an unsafe partial patch.');
    }

    const replacement = `// [ForgeGuard] refresh sessions only for newly mapped LIDs
                const lids = lidResults.map(a => a.lid);
                const newLidUsers = new Set(stored.map(pair => pair.lidUser));
                const isNewlyMapped = lid => newLidUsers.has(jidDecode(lid)?.user ?? '');
                const newLids = lids.filter(isNewlyMapped);
                const knownLids = lids.filter(lid => !isNewlyMapped(lid));

                // Force-refresh only new or changed PN↔LID mappings. Known LIDs use
                // normal validation so existing sessions are reused rather than rebuilt.
                if (newLids.length) {
                    try {
                        await assertSessions(newLids, true);
                    } catch (error) {
                        logger.warn({ error, count: newLids.length }, 'failed to assert sessions for newly mapped LIDs');
                    }
                }
                if (knownLids.length) {
                    try {
                        await assertSessions(knownLids);
                    } catch (error) {
                        logger.warn({ error, count: knownLids.length }, 'failed to assert sessions for known LIDs');
                    }
                }`;
    source = source.replace(refreshBlock, replacement);
    return { source, changed: true };
}

export function patchLidMappingStore(source) {
    const marker = '[ForgeGuard] storeLIDPNMappings returns newly mapped pairs';
    if (source.includes(marker)) return { source, changed: false };
    if (!source.includes('class LIDMappingStore') || !source.includes('async storeLIDPNMappings(pairs)')) {
        throw new Error('Baileys LIDMappingStore implementation was not found; refusing an unsafe partial patch.');
    }

    const wrapper = `

// [ForgeGuard] storeLIDPNMappings returns newly mapped pairs
if (!LIDMappingStore.prototype.storeLIDPNMappings.__forgeReturnsNewPairs) {
    const originalStoreLIDPNMappings = LIDMappingStore.prototype.storeLIDPNMappings;
    const storeQueues = new WeakMap();

    const storeLIDPNMappingsWithNewPairResult = async function(pairs) {
        const previous = storeQueues.get(this) || Promise.resolve();
        let release;
        const current = new Promise(resolve => { release = resolve; });
        storeQueues.set(this, current);
        await previous;

        try {
            if (!Array.isArray(pairs) || pairs.length === 0) return [];

            const validatedPairs = [];
            for (const { lid, pn } of pairs) {
                if (!((isLidUser(lid) && isPnUser(pn)) || (isPnUser(lid) && isLidUser(pn)))) continue;
                const lidDecoded = jidDecode(lid);
                const pnDecoded = jidDecode(pn);
                if (!lidDecoded || !pnDecoded) continue;
                validatedPairs.push({ pnUser: pnDecoded.user, lidUser: lidDecoded.user });
            }

            const existingMappings = new Map();
            const cacheMisses = new Set();
            for (const { pnUser } of validatedPairs) {
                const cached = this.mappingCache.get('pn:' + pnUser);
                if (cached) existingMappings.set(pnUser, cached);
                else cacheMisses.add(pnUser);
            }

            if (cacheMisses.size > 0) {
                const missingUsers = [...cacheMisses];
                const stored = await this.keys.get('lid-mapping', missingUsers);
                for (const pnUser of missingUsers) {
                    const existingLidUser = stored[pnUser];
                    if (existingLidUser) {
                        existingMappings.set(pnUser, existingLidUser);
                        this.mappingCache.set('pn:' + pnUser, existingLidUser);
                        this.mappingCache.set('lid:' + existingLidUser, pnUser);
                    }
                }
            }

            const newlyMapped = new Map();
            for (const { pnUser, lidUser } of validatedPairs) {
                if (existingMappings.get(pnUser) !== lidUser) newlyMapped.set(pnUser, lidUser);
            }

            await originalStoreLIDPNMappings.call(this, pairs);
            return [...newlyMapped].map(([pnUser, lidUser]) => ({ pnUser, lidUser }));
        } finally {
            release();
            if (storeQueues.get(this) === current) storeQueues.delete(this);
        }
    };

    Object.defineProperty(storeLIDPNMappingsWithNewPairResult, '__forgeReturnsNewPairs', { value: true });
    LIDMappingStore.prototype.storeLIDPNMappings = storeLIDPNMappingsWithNewPairResult;
}
`;
    return { source: source + wrapper, changed: true };
}

export function patchLargeSessionDiagnostics(source) {
    if (source.includes('[Baileys session diagnostic]')) {
        return { source, changed: false };
    }

    const functionMarker = 'const assertSessions = async';
    const keyListMarker = /const jidsRequiringFetch = \[\];?/;
    const validationBlock = /if\s*\(sessionValidation\.exists\)\s*\{\s*continue;?\s*\}/;
    const fetchBlock = /if\s*\(jidsRequiringFetch\.length\)\s*\{/;

    if (!source.includes(functionMarker) || !keyListMarker.test(source) || !validationBlock.test(source) || !fetchBlock.test(source)) {
        throw new Error('Baileys assertSessions validation flow was not found; refusing an unsafe diagnostic patch.');
    }

    source = source.replace(
        functionMarker,
        'let lastLargeSessionDiagnosticAt = 0;\n\tconst assertSessions = async'
    );
    source = source.replace(
        keyListMarker,
        match => match + '\n\t\tlet openSessionCount = 0;\n\t\tlet missingSessionCount = 0;\n\t\tlet closedSessionCount = 0;\n\t\tlet validationErrorCount = 0;'
    );
    source = source.replace(
        validationBlock,
        `if (sessionValidation.exists) {
                    openSessionCount++;
                    continue;
                }
                if (sessionValidation.reason === 'no session') missingSessionCount++;
                else if (sessionValidation.reason === 'no open session') closedSessionCount++;
                else validationErrorCount++;`
    );
    source = source.replace(
        fetchBlock,
        `const diagnosticNow = Date.now();
        if (uniqueJids.length >= 100 && diagnosticNow - lastLargeSessionDiagnosticAt >= 5 * 60 * 1000) {
            lastLargeSessionDiagnosticAt = diagnosticNow;
            const lidTargets = uniqueJids.filter(jid => isLidUser(jid) || isHostedLidUser(jid)).length;
            const pnTargets = uniqueJids.length - lidTargets;
            console.warn('[Baileys session diagnostic] targets=' + uniqueJids.length + ' open=' + openSessionCount + ' missing=' + missingSessionCount + ' closed=' + closedSessionCount + ' validationErrors=' + validationErrorCount + ' fetch=' + jidsRequiringFetch.length + ' lid=' + lidTargets + ' pn=' + pnTargets + ' force=' + !!force);
        }
        if (jidsRequiringFetch.length) {`
    );

    return { source, changed: true };
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

function resolveBaileysSignalFile(filename) {
    const require = createRequire(import.meta.url);
    const entry = require.resolve('@whiskeysockets/baileys');
    const libraryDirectory = path.dirname(entry);
    const candidates = [
        path.join(libraryDirectory, 'Signal', filename),
        path.join(libraryDirectory, 'signal', filename)
    ];
    const found = candidates.find(candidate => fs.existsSync(candidate));
    if (!found) throw new Error('Could not locate Baileys Signal/' + filename + ' beside ' + entry);
    return found;
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
    const mappingPath = resolveBaileysSignalFile('lid-mapping.js');
    const sendChurnResult = patchMessagesSend(fs.readFileSync(sendPath, 'utf8'));
    const sendDiagnosticResult = patchLargeSessionDiagnostics(sendChurnResult.source);
    const mappingResult = patchLidMappingStore(fs.readFileSync(mappingPath, 'utf8'));
    const receiveResult = patchMessagesReceive(fs.readFileSync(receivePath, 'utf8'));

    if (sendChurnResult.changed || sendDiagnosticResult.changed) fs.writeFileSync(sendPath, sendDiagnosticResult.source);
    if (mappingResult.changed) fs.writeFileSync(mappingPath, mappingResult.source);
    if (receiveResult.changed) fs.writeFileSync(receivePath, receiveResult.source);

    console.log(
        '[Baileys compatibility] LID session churn guard=' + (sendChurnResult.changed ? 'patched' : 'already patched') +
        '; LID mapping new-pair detection=' + (mappingResult.changed ? 'patched' : 'already patched') +
        '; session validation diagnostics=' + (sendDiagnosticResult.changed ? 'patched' : 'already patched') +
        '; first-retry key recovery=' + (receiveResult.changed ? 'patched' : 'already patched')
    );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    applyBaileysLidSessionPatches();
}
