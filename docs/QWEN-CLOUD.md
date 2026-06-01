# Qwen Cloud (DashScope TTS)

Hosted **Qwen3-TTS** via Alibaba DashScope — no GPU pod, works on Vercel beta.

## Setup

1. Create an API key: [Model Studio / DashScope](https://www.alibabacloud.com/help/en/model-studio/get-api-key)  
   - **International (Singapore):** use keys from the Singapore console for `dashscope-intl.aliyuncs.com`.
2. Add to `.env.local` / Vercel:

```env
DASHSCOPE_API_KEY=sk-...
# Optional — default: Singapore international
# DASHSCOPE_BASE_URL=https://dashscope-intl.aliyuncs.com/api/v1
# With instruct (Cast mood): qwen3-tts-instruct-flash
QWEN_CLOUD_MODEL=qwen3-tts-instruct-flash
# Without instruct chunks use flash (supports Ryan voice)
# QWEN_CLOUD_MODEL_FLASH=qwen3-tts-flash
```

3. Deploy or restart `npm run dev`.
4. Settings → **Qwen Cloud** → save. Preview needs login (same as ElevenLabs server TTS).

Health check: `GET /api/health` → `serverQwenCloudTts: true`.

## API route

`POST /api/tts/qwen-cloud` (authenticated, rate-limited)

```json
{
  "text": "Hallo, ich erzähle deine Geschichte.",
  "voice": "Ryan",
  "language": "German",
  "instruct": "ruhig, warm, leicht dramatisch",
  "storyLocale": "de"
}
```

Returns WAV/MP3 bytes. Instruct uses `qwen3-tts-instruct-flash`; plain lines use `qwen3-tts-flash`.

**Limit:** max **600 characters** per API call — long turns are split automatically and concatenated.

## Cost (rough)

| Usage | ~cost (Flash) |
|-------|----------------|
| 100k chars/month | ~$1 |
| 500k chars/month | ~$5 |
| 2M chars/month | ~$20 |

Compare with ElevenLabs in the same story sessions for beta budgeting.

## vs local Qwen

| | Qwen Cloud | `npm run tts:qwen` |
|--|------------|-------------------|
| Latency | Usually faster | 8–23s/line on GTX 1080 Ti |
| Cost | Per character | Electricity only |
| instruct | Yes (API) | Yes (local model) |
| Vercel | Yes | No |

## Voices

**Qwen Cloud ≠ local CustomVoice.** `Ryan` / `Aiden` exist only on the **local** GPU model. On DashScope:

| Local (self-host) | Cloud (instruct) |
|-------------------|------------------|
| Ryan | **Kai** (ruhiger Erzähler-Male) |
| Serena | Serena |
| Aiden / Eric | Ethan |
| Uncle_Fu | Eldric Sage |

The server maps these automatically. Default cloud narrator: **Kai**.

**Qualität:** Szenen-Stil gilt nur für den **Erzähler**, nicht für Dialog-Zitate. Englischer Text → `language_type: English` (auch bei DE-Story). `optimize_instructions` ist standardmäßig aus (weniger „künstlich“); optional `QWEN_CLOUD_OPTIMIZE_INSTRUCTIONS=1`.

Instruct uses `qwen3-tts-instruct-flash` (Ryan is **not** supported there). Plain lines without instruct use `qwen3-tts-flash`.

## Troubleshooting

- **Invalid API key** — wrong region (Beijing key on intl URL or vice versa).
- **Voice 'Ryan' is not supported** — expected on instruct; app maps Ryan → Ethan. Reload after deploy.
- **Slow local instruct** — try Cloud to see if slowness is GPU vs instruct length.
