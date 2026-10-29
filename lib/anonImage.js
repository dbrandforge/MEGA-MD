import sharp from 'sharp';

function escapeXml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function wrapText(text, maxChars = 36) {
    const words = String(text).trim().split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
        if ((line + ' ' + w).trim().length > maxChars) {
            if (line) lines.push(line);
            line = w;
        } else {
            line = (line + ' ' + w).trim();
        }
    }
    if (line) lines.push(line);
    return lines.slice(0, 18); // max lines
}

/**
 * Build PNG buffer: dark card + message + Mature Minded watermark
 */
export async function textToAnonImage(text) {
    const lines = wrapText(text, 34);
    const lineHeight = 36;
    const topPad = 90;
    const bottomPad = 80;
    const height = Math.max(420, topPad + lines.length * lineHeight + bottomPad);
    const width = 720;

    const textSvg = lines.map((ln, i) => {
        const y = topPad + i * lineHeight;
        return `<text x="50%" y="${y}" text-anchor="middle" fill="#f5f5f5" font-size="26" font-family="Arial, Helvetica, sans-serif">${escapeXml(ln)}</text>`;
    }).join('\n');

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a0a12"/>
      <stop offset="100%" stop-color="#0f0f14"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="24" y="24" width="${width - 48}" height="${height - 48}" rx="24" fill="#1c1218" stroke="#e11d48" stroke-width="2"/>
  <text x="50%" y="58" text-anchor="middle" fill="#e11d48" font-size="22" font-family="Arial, Helvetica, sans-serif" font-weight="bold">🕵️ ANONYMOUS</text>
  ${textSvg}
  <text x="50%" y="${height - 36}" text-anchor="middle" fill="#f472b6" font-size="20" font-family="Arial, Helvetica, sans-serif" font-weight="bold" opacity="0.95">MATURE MINDED</text>
  <text x="50%" y="${height - 14}" text-anchor="middle" fill="#666" font-size="12" font-family="Arial, Helvetica, sans-serif">Anonymous Night • no name shown</text>
</svg>`;

    return sharp(Buffer.from(svg))
        .png()
        .toBuffer();
}

export default { textToAnonImage };
