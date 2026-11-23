import mongoose from 'mongoose';
import zlib from 'node:zlib';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

const execFileAsync = promisify(execFile);
const mongoUrl = String(process.env.MONGO_URL || '').trim();
const groupJid = String(process.env.GROUP_JID || '').trim();
if (!mongoUrl) throw new Error('MONGO_URL secret is missing.');
if (!/^\\d+@g\\.us$/.test(groupJid)) throw new Error('GROUP_JID must be a WhatsApp group JID ending in @g.us.');

const start = new Date('2026-11-21T21:00:00.000Z');
const end = new Date('2026-11-21T23:00:00.000Z');
const target = 'i don chop caramel work that girl no sabi she just dey make mouth';
const targetWords = target.split(' ');

function asBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string') return Buffer.from(value, 'base64');
  if (value && value.type === 'Buffer' && Array.isArray(value.data)) return Buffer.from(value.data);
  if (value && value.$binary?.base64) return Buffer.from(value.$binary.base64, 'base64');
  if (value && typeof value.toBuffer === 'function') return value.toBuffer();
  if (value && value.buffer) return Buffer.from(value.buffer);
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length && keys.every(k => /^\\d+$/.test(k))) return Buffer.from(keys.sort((a,b) => Number(a)-Number(b)).map(k => value[k]));
  }
  throw new Error('Unsupported binary value.');
}

function decodeMessage(value) {
  const bytes = asBuffer(value);
  try { return JSON.parse(zlib.inflateSync(bytes).toString('utf8')); }
  catch {
    try { return JSON.parse(bytes.toString('utf8')); }
    catch { throw new Error('Stored message decode failed.'); }
  }
}

function normalizeWords(value) {
  return String(value || '').toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ').trim().split(/\\s+/).filter(Boolean);
}

function editDistance(a, b) {
  const row = Array.from({length: b.length + 1}, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = old;
    }
  }
  return row[b.length];
}

function targetWordMatched(word, ocrWords) {
  return ocrWords.some(candidate => candidate === word ||
    (word.length >= 5 && candidate.length >= 5 && editDistance(word, candidate) <= 1));
}

async function decryptImage(image) {
  const normalized = {...image};
  for (const field of ['mediaKey', 'fileSha256', 'fileEncSha256', 'jpegThumbnail']) {
    if (normalized[field] != null) normalized[field] = asBuffer(normalized[field]);
  }
  const stream = await downloadContentFromMessage(normalized, 'image');
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  if (!chunks.length) throw new Error('Downloaded media was empty.');
  return Buffer.concat(chunks);
}

async function main() {
  await mongoose.connect(mongoUrl, {serverSelectionTimeoutMS: 15000, readPreference: 'secondaryPreferred'});
  const collection = mongoose.connection.db.collection('messages');
  const cursor = collection.find(
    {jid: groupJid, ts: {$gte: start.getTime(), $lt: end.getTime()}},
    {projection: {_id: 0, id: 1, data: 1, ts: 1}, batchSize: 100}
  ).sort({ts: 1});

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'anon-ocr-'));
  let scanned = 0, imageCount = 0, downloaded = 0, ocrFailures = 0;
  const candidates = [];
  try {
    for await (const row of cursor) {
      scanned++;
      let message;
      try { message = decodeMessage(row.data); } catch { continue; }
      if (message?.key?.fromMe !== true) continue;
      const image = message?.message?.imageMessage;
      if (!image) continue;
      imageCount++;

      try {
        const bytes = await decryptImage(image);
        downloaded++;
        const ext = String(image.mimetype || '').includes('png') ? '.png' : '.jpg';
        const imagePath = path.join(tempDir, String(row.id).replace(/[^a-zA-Z0-9_-]/g, '_') + ext);
        await fs.writeFile(imagePath, bytes);
        const {stdout} = await execFileAsync('tesseract', [imagePath, 'stdout', '-l', 'eng', '--psm', '6'], {encoding: 'utf8', timeout: 25000, maxBuffer: 1024 * 1024});
        await fs.unlink(imagePath).catch(() => {});
        const words = normalizeWords(stdout);
        const matched = targetWords.filter(word => targetWordMatched(word, words)).length;
        const score = matched / targetWords.length;
        if (score >= 0.65) {
          candidates.push({
            storedAtWAT: new Date(Number(row.ts) + 3600000).toISOString().replace('T', ' ').replace('Z', ''),
            messageId: String(row.id),
            matchScore: Number(score.toFixed(3)),
            ocrText: String(stdout).trim().slice(0, 1200)
          });
        }
      } catch (error) {
        ocrFailures++;
        process.stderr.write('[MEDIA_OCR_WARNING] id=' + String(row.id) + ' reason=' + String(error?.message || error).slice(0, 240) + '\\n');
      }
    }
  } finally {
    await fs.rm(tempDir, {recursive: true, force: true});
  }

  candidates.sort((a,b) => b.matchScore - a.matchScore || a.storedAtWAT.localeCompare(b.storedAtWAT));
  const report = {
    investigation: 'OCR match for target anonymous card',
    groupJid,
    targetText: target,
    timezone: 'Africa/Lagos (UTC+01:00)',
    localWindow: '2026-11-21 22:00:00 inclusive to 2026-11-22 00:00:00 exclusive',
    scannedRecords: scanned,
    outgoingImageCount: imageCount,
    downloadedImages: downloaded,
    mediaOrOcrFailures: ocrFailures,
    candidateCount: candidates.length,
    candidates
  };
  await fs.writeFile('anonymous-target-ocr-report.json', JSON.stringify(report, null, 2) + '\\n');
  console.log(JSON.stringify({...report, candidates: candidates.map(({storedAtWAT,messageId,matchScore}) => ({storedAtWAT,messageId,matchScore}))}, null, 2));
}

main()
  .catch(error => { console.error('[OCR_FORENSICS_FAILED]', error.stack || error.message); process.exitCode = 1; })
  .finally(async () => { await mongoose.disconnect().catch(() => {}); });
