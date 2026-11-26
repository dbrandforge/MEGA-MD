/**
 * Convert a creator's natural-language intent into the canonical command text
 * expected by legacy plugins. Preserve WhatsApp contextInfo so mentions and
 * quoted-member targets continue to work.
 */
export function normalizeCreatorCommandMessage(message, intent, prefix = '.') {
    const command = String(intent?.command || '').trim().toLowerCase();
    if (!command) return message;

    const args = Array.isArray(intent?.args)
        ? intent.args.slice(0, 20).map(value => String(value))
        : [];
    const normalizedText = `${prefix}${command}${args.length ? ' ' + args.join(' ') : ''}`;
    const content = { ...(message?.message || {}) };

    if (typeof content.conversation === 'string') {
        content.conversation = normalizedText;
    } else if (content.extendedTextMessage) {
        content.extendedTextMessage = { ...content.extendedTextMessage, text: normalizedText };
    } else if (content.imageMessage && typeof content.imageMessage.caption === 'string') {
        content.imageMessage = { ...content.imageMessage, caption: normalizedText };
    } else if (content.videoMessage && typeof content.videoMessage.caption === 'string') {
        content.videoMessage = { ...content.videoMessage, caption: normalizedText };
    } else if (content.buttonsResponseMessage) {
        content.buttonsResponseMessage = { ...content.buttonsResponseMessage, selectedButtonId: normalizedText };
    } else {
        content.conversation = normalizedText;
    }

    return { ...message, message: content };
}
