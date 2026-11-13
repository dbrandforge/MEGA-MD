# Forge Guard: zero-cost media processing

Forge Guard's voice-note transcription and sticker understanding use the Groq API Free Plan only.

## Provider boundaries

- Voice notes: `whisper-large-v3-turbo` through Groq's speech-to-text endpoint.
- Stickers: `qwen/qwen3.8-27b` through Groq's vision-capable chat-completions endpoint.
- The general chatbot remains on its existing Gemini integration. This media change does not reroute ordinary text conversations.
- Media processing does not fall back to Gemini, OpenAI, Google Cloud, AssemblyAI, or any paid provider if Groq is unavailable or its free quota is exhausted.
- A Groq HTTP 429 is treated as a hard free-tier limit. Forge Guard does not retry it or switch providers.

## Free-plan requirement

Create a Groq account and API key while remaining on the Free Plan. Do not upgrade to Developer, add a payment method, or enable paid capacity. Groq's Free Plan FAQ says usage within the Free Plan is not charged and requests beyond free limits are rate-limited instead of billed. Plan limits and model availability can change; confirm the current limits in the Groq console before relying on them.

## Environment variable

Set this single variable in the bot service:

```env
GROQ_API_KEY=your_groq_api_key
```

Do not paste the key into chat, GitHub issues, commits, or source files. Store it only as a secret environment variable in the hosting dashboard.

No new npm dependency is required; the project already includes `axios` and `form-data`.

## Existing safeguards retained

- Voice notes are processed only when sent as WhatsApp push-to-talk (`ptt`) audio; ordinary audio attachments are not treated as voice notes.
- Voice note: maximum 60 seconds and 2 MB. The supported MIME types are OGG/Opus, MP3/MPEG, WAV, M4A/MP4, WebM, and FLAC; unsupported formats are skipped.
- Sticker download: maximum 1.5 MB; the image is resized/re-encoded to a maximum 300 KB vision payload. Animated stickers are processed as a static frame, not as animation.
- Two concurrent media jobs maximum, with a 12-second per-sender/per-chat/type cooldown.
- Daily application caps: voice notes 2 per sender, 3 per chat, 5 bot-wide; stickers 5 per sender, 10 per chat, 20 bot-wide. Counters are persisted and failed processing attempts are refunded where possible.
- Both features default OFF in every chat and must be explicitly enabled per chat. In groups, the media must also explicitly address the bot under the existing mention/reply rules.
- A missing `GROQ_API_KEY` is detected before downloading the WhatsApp media.
- Existing group-addressing rules and chatbot access checks remain unchanged.
- A free-tier 429 does not trigger repeated requests or a paid-provider fallback.
- Normal chatbot requests continue through the existing chatbot path.

## Bandwidth and availability

Groq API calls still use outbound Render bandwidth: WhatsApp media must be downloaded by the bot and then uploaded to Groq. This integration avoids a paid API bill, but it does not make media traffic bandwidth-free. The existing small media limits and daily caps are retained to protect the Render allowance.

The Free Plan is rate-limited, not unlimited. The published rate table currently lists Qwen 3.8 27B at 30 requests/minute, 1,000 requests/day, 8,000 tokens/minute, and 200,000 tokens/day per organization; Whisper Large V3 Turbo at 20 requests/minute, 2,000 requests/day, 7,200 audio seconds/hour, and 28,800 audio seconds/day. These provider limits are shared at the Groq organization level, may change, and are separate from Forge Guard's much lower application caps. Check the live Groq Console for the exact limits on your account. If Groq returns HTTP 429, the affected media request fails gracefully without retry or fallback; ordinary text chatbot operation remains separate.
