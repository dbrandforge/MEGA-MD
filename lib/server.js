import express from 'express';
import { createServer } from 'http';
import config from '../config.js';
import { textToAnonImage } from './anonImage.js';

const packageInfo = {
    name: config.botName || 'Forge Bot',
    version: config.version || '6.1.0',
    description: config.description || 'WhatsApp Bot',
    author: config.author || 'Forge'
};

const app = express();
const server = createServer(app);
const PORT = config.port || 5000;

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

const TARGET_GROUP = '120363405434471171@g.us';

app.get('/', (req, res) => {
    const uptimeSeconds = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${packageInfo.name}</title>
    <style>body{font-family:system-ui;background:#0f172a;color:#fff;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}
    .c{background:#1e293b;padding:28px;border-radius:16px;text-align:center;max-width:360px}
    .ok{color:#25d366;font-weight:700}</style></head>
    <body><div class="c"><div class="ok">ONLINE</div><h1>${packageInfo.name}</h1>
    <p>Uptime ${hours}h ${minutes}m ${seconds}s</p></div></body></html>`);
});

app.get('/health', (req, res) => {
    const mem = process.memoryUsage();
    res.json({ status: 'ok', uptime: Math.floor(process.uptime()), memory: { rss: `${Math.round(mem.rss / 1024 / 1024)}MB` }, version: packageInfo.version });
});

/** Anonymous form — TEXT ONLY */
app.get('/anon/:groupId', (req, res) => {
    const groupId = req.params.groupId;
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Anonymous Night</title>
<style>
  body{margin:0;font-family:system-ui;background:#0f0f12;color:#f5f5f5;display:flex;justify-content:center;padding:24px}
  .box{width:100%;max-width:420px;background:#1a1a22;border-radius:16px;padding:20px;border:1px solid #2a2a35}
  h1{font-size:1.25rem;margin:0 0 8px}
  p{color:#aaa;font-size:0.9rem}
  textarea{width:100%;box-sizing:border-box;background:#111;border:1px solid #333;color:#fff;border-radius:10px;padding:12px;margin:8px 0;min-height:120px}
  button{width:100%;padding:14px;border:0;border-radius:10px;background:#e11d48;color:#fff;font-weight:700;font-size:1rem}
  .ok{color:#4ade80;display:none;margin-top:12px;text-align:center}
  .hint{font-size:0.8rem;color:#888}
</style>
</head>
<body>
<div class="box">
  <h1>🕵️ Anonymous Night</h1>
  <p>Type your confession / fantasy / secret. <b>No name</b> is shown. Text only — converted to image in the group.</p>
  <form id="f">
    <textarea name="text" rows="6" maxlength="800" placeholder="Type your anonymous message..." required></textarea>
    <p class="hint">Max 800 characters. No photo upload.</p>
    <button type="submit">Send anonymously</button>
  </form>
  <div class="ok" id="ok">✅ Sent. Check the group.</div>
</div>
<script>
const gid = ${JSON.stringify(groupId)};
document.getElementById('f').onsubmit = async (e) => {
  e.preventDefault();
  const text = new FormData(e.target).get('text') || '';
  if (!String(text).trim()) return alert('Type a message');
  const res = await fetch('/anon/' + gid + '/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: String(text).trim() })
  });
  if (res.ok) {
    document.getElementById('ok').style.display = 'block';
    e.target.reset();
  } else {
    const j = await res.json().catch(() => ({}));
    alert(j.error || 'Failed. Anonymous may be closed.');
  }
};
</script>
</body></html>`);
});

app.post('/anon/:groupId/submit', async (req, res) => {
    try {
        const groupId = req.params.groupId;
        const chatId = groupId.includes('@') ? groupId : `${groupId}@g.us`;
        if (chatId !== TARGET_GROUP) {
            return res.status(403).json({ error: 'Invalid group' });
        }

        const sock = global.__forgeSock;
        if (!sock) return res.status(503).json({ error: 'Bot offline' });

        let enabled = true;
        try {
            const store = (await import('./lightweight_store.js')).default;
            const state = (await store.getSetting(chatId, 'anonymousState')) || {};
            if (state.enabled === false) enabled = false;
        } catch {}
        if (!enabled) return res.status(403).json({ error: 'Anonymous Night is closed' });

        const text = String(req.body?.text || '').trim().slice(0, 800);
        if (!text) return res.status(400).json({ error: 'Empty message' });

        // Convert text → image with Mature Minded watermark
        const imageBuffer = await textToAnonImage(text);

        // Tag everyone
        let mentions = [];
        try {
            const meta = await sock.groupMetadata(chatId);
            mentions = (meta.participants || []).map(p => p.id);
        } catch {}

        await sock.sendMessage(chatId, {
            image: imageBuffer,
            caption: '🕵️ *Anonymous Night*\n@all',
            mentions
        });

        res.json({ ok: true });
    } catch (e) {
        console.error('Anon submit error:', e.message);
        res.status(500).json({ error: 'Server error' });
    }
});

export { app, server, PORT };
