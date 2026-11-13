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

- Voice note: maximum 60 seconds and 2 MB.
- Sticker download: maximum 1.5 MB; resized vision payload: maximum 300 KB.
- Two concurrent media jobs maximum.
- Per-sender, per-chat, and bot-wide daily limits remain enforced and persisted.
- Existing group-addressing rules and per-chat opt-in switches remain unchanged.
- A free-tier 429 does not trigger repeated requests or a paid-provider fallback.
- Normal chatbot requests continue through the existing chatbot path.

## Bandwidth and availability

Groq API calls still use outbound Render bandwidth: WhatsApp media must be downloaded by the bot and then uploaded to Groq. This integration avoids a paid API bill, but it does not make media traffic bandwidth-free. The existing small media limits and daily caps are retained to protect the Render allowance.

The Free Plan is rate-limited, not unlimited. If its quota is exhausted, the affected media request fails gracefully; ordinary text chatbot operation remains separate.
