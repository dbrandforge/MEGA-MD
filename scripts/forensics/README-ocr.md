# Anonymous image OCR forensic pass

This isolated forensic utility decrypts bot-originated image messages from the
configured WhatsApp group and runs local Tesseract OCR to match the specific
anonymous card under investigation.

It writes only candidate message IDs, stored timestamps, OCR match scores, and
OCR text for near-matches. It does not write to MongoDB, send WhatsApp messages,
or alter the production bot.
