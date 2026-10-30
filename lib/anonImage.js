import sharp from 'sharp';

function escapeXml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function splitLongWord(word, maxChars) {
    const parts = [];
    for (let i = 0; i < word.length; i += maxChars) {
        parts.push(word.slice(i, i + maxChars));
    }
    return parts;
}

function wrapText(text, maxChars) {
    const words = String(text).trim().split(/\s+/).flatMap(word =>
        word.length > maxChars ? splitLongWord(word, maxChars) : [word]
    );
    const lines = [];
    let line = '';

    for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (next.length > maxChars && line) {
            lines.push(line);
            line = word;
        } else {
            line = next;
        }
    }
    if (line) lines.push(line);
    return lines;
}

/**
 * Render a fixed, reference-inspired anonymous message card.
 * Existing Mature Minded palette and watermark are intentionally retained.
 */
export async function textToAnonImage(text) {
    const value = String(text).trim();
    if (!value) throw new Error('Anonymous message cannot be empty');
    if (value.length > 300) throw new Error('Anonymous message exceeds 300 characters');

    const width = 720;
    const height = 520;
    const headerHeight = 150;
    const messageTop = headerHeight + 24;
    const messageBottom = 430;
    const messageAreaHeight = messageBottom - messageTop;
    const maxFontSize = 54;
    const minFontSize = 27;
    let chosen = null;

    // Reduce type size only as much as needed to keep every character visible.
    for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 1) {
        const maxChars = Math.max(12, Math.floor((width - 112) / (fontSize * 0.58)));
        const lines = wrapText(value, maxChars);
        const lineHeight = Math.round(fontSize * 1.2);
        if (lines.length * lineHeight <= messageAreaHeight) {
            chosen = { fontSize, lines, lineHeight };
            break;
        }
    }

    // 300 characters should fit; this fallback keeps rendering safe if fonts differ.
    if (!chosen) {
        const fontSize = minFontSize;
        const maxChars = Math.floor((width - 112) / (fontSize * 0.58));
        const lines = wrapText(value, maxChars);
        chosen = { fontSize, lines, lineHeight: Math.round(fontSize * 1.12) };
    }

    const blockHeight = chosen.lines.length * chosen.lineHeight;
    const firstBaseline = messageTop + (messageAreaHeight - blockHeight) / 2 + chosen.fontSize;
    const messageSvg = chosen.lines.map((line, index) =>
        `<text x="50%" y="${Math.round(firstBaseline + index * chosen.lineHeight)}" text-anchor="middle" fill="#f5f5f5" font-size="${chosen.fontSize}" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeXml(line)}</text>`
    ).join('\n');

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a0a12"/>
      <stop offset="100%" stop-color="#0f0f14"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" rx="34" fill="url(#bg)"/>
  <rect x="24" y="24" width="${width - 48}" height="${height - 48}" rx="26" fill="#1c1218" stroke="#e11d48" stroke-width="2"/>
  <path d="M50 24 H670 Q696 24 696 50 V${headerHeight} H24 V50 Q24 24 50 24Z" fill="#1c1218"/>
  <text x="50%" y="91" text-anchor="middle" fill="#e11d48" font-size="28" font-family="Arial, Helvetica, sans-serif" font-weight="700" letter-spacing="0.5">🕵️ ANONYMOUS</text>
  <path d="M25 ${headerHeight} H695" stroke="#e11d48" stroke-opacity="0.45" stroke-width="1"/>
  ${messageSvg}
  <text x="50%" y="468" text-anchor="middle" fill="#f472b6" font-size="22" font-family="Arial, Helvetica, sans-serif" font-weight="700" opacity="0.95">MATURE MINDED</text>
  <text x="50%" y="493" text-anchor="middle" fill="#888" font-size="13" font-family="Arial, Helvetica, sans-serif">Anonymous Night • no name shown</text>
</svg>`;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

export default { textToAnonImage };
