import mongoose from 'mongoose';
import zlib from 'node:zlib';
import fs from 'node:fs/promises';

const mongoUrl = String(process.env.MONGO_URL || '').trim();
const groupJid = String(process.env.GROUP_JID || '').trim();
if (!mongoUrl) throw new Error('MONGO_URL secret is missing.');
if (!/^\d+@g\.us$/.test(groupJid)) throw new Error('GROUP_JID must be a WhatsApp group JID ending in @g.us.');

const start = new Date('2026-11-21T21:00:00.000Z'); // 22:00 Africa/Lagos
const end = new Date('2026-11-21T23:00:00.000Z');   // 00:00 Africa/Lagos, exclusive
const startMs = start.getTime();
const endMs = end.getTime();

function asBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value && typeof value.toBuffer === 'function') return value.toBuffer();
  if (value && value.buffer) return Buffer.from(value.buffer);
  if (value instanceof Uint8Array) return Buffer.from(value);
  throw new Error('Message data is not a supported binary value.');
}

function decodeMessage(value) {
  const bytes = asBuffer(value);
  try {
    return JSON.parse(zlib.inflateSync(bytes).toString('utf8'));
  } catch (inflateError) {
    // The production store has a raw-JSON fallback if compression failed.
    try {
      return JSON.parse(bytes.toString('utf8'));
    } catch {
      throw new Error('Could not decode stored message (inflate and raw JSON both failed).');
    }
  }
}

function timestampSeconds(value) {
  if (value == null) return null;
  if (typeof value === 'number') return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const n = Number(value);
    return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
  }
  return null;
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return '"' + text.replaceAll('"', '""') + '"';
}

async function main() {
  await mongoose.connect(mongoUrl, {
    serverSelectionTimeoutMS: 15000,
    readPreference: 'secondaryPreferred'
  });

  const collection = mongoose.connection.db.collection('messages');
  const cursor = collection.find(
    { jid: groupJid, ts: { $gte: startMs, $lt: endMs } },
    { projection: { _id: 0, jid: 1, id: 1, data: 1, ts: 1 }, batchSize: 250 }
  ).sort({ ts: 1 });

  let scanned = 0;
  let decodeFailures = 0;
  const matches = [];

  for await (const row of cursor) {
    scanned++;
    let message;
    try {
      message = decodeMessage(row.data);
    } catch (error) {
      decodeFailures++;
      process.stderr.write('[DECODE_WARNING] id=' + String(row.id) + ' reason=' + error.message + '\n');
      continue;
    }

    if (message?.key?.fromMe !== true) continue;
    const image = message?.message?.imageMessage;
    if (!image) continue;

    const messageSeconds = timestampSeconds(message.messageTimestamp);
    matches.push({
      storedAtUtc: new Date(Number(row.ts)).toISOString(),
      messageTimestampUtc: messageSeconds == null ? null : new Date(messageSeconds * 1000).toISOString(),
      messageId: String(row.id),
      caption: typeof image.caption === 'string' ? image.caption : ''
    });
  }

  matches.sort((a, b) => (a.messageTimestampUtc || a.storedAtUtc).localeCompare(b.messageTimestampUtc || b.storedAtUtc));

  const report = {
    investigation: 'Outgoing WhatsApp image messages',
    groupJid,
    timezone: 'Africa/Lagos (UTC+01:00)',
    localWindow: '2026-11-21 22:00:00 inclusive to 2026-11-22 00:00:00 exclusive',
    utcWindow: { startInclusive: start.toISOString(), endExclusive: end.toISOString() },
    collection: 'messages',
    scannedRecords: scanned,
    outgoingImageCount: matches.length,
    decodeFailures,
    records: matches
  };

  await fs.writeFile('outgoing-image-forensics.json', JSON.stringify(report, null, 2) + '\n', { flag: 'w' });
  const csv = [
    ['storedAtUtc', 'messageTimestampUtc', 'messageId', 'caption'].map(csvCell).join(','),
    ...matches.map(row => [row.storedAtUtc, row.messageTimestampUtc, row.messageId, row.caption].map(csvCell).join(','))
  ].join('\n') + '\n';
  await fs.writeFile('outgoing-image-forensics.csv', csv, { flag: 'w' });

  console.log(JSON.stringify({
    status: 'completed',
    groupJid,
    localWindow: report.localWindow,
    scannedRecords: scanned,
    outgoingImageCount: matches.length,
    decodeFailures,
    jsonReport: 'outgoing-image-forensics.json',
    csvReport: 'outgoing-image-forensics.csv'
  }, null, 2));
}

main()
  .catch(error => {
    console.error('[FORENSICS_FAILED]', error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
