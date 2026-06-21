#!/usr/bin/env node
/**
 * Seed RP Audiobook bootstrap memories into agentmemory (localhost:3111).
 * Run after: npx @agentmemory/agentmemory  (or ~/start-agentmemory.ps1)
 */
const BASE = process.env.AGENTMEMORY_URL || "http://127.0.0.1:3111";
const PROJECT = "RP Audiobook";

const memories = [
  {
    type: "architecture",
    content:
      "RP Audiobook is a Next.js 15 + Supabase interactive story RPG (local-first or SaaS). Server LLM via OpenRouter; server TTS options include Fish, ElevenLabs, and OpenRouter TTS. Core loop: Story → Chapter → Chat turns with optional narrator audio + client-side soundscape. Brand in src/lib/brand.ts.",
    concepts: [
      "rp-audiobook",
      "hoerbuchki",
      "nextjs",
      "supabase",
      "fish-tts",
      "vercel",
      "interactive-fiction",
    ],
    files: ["README.md", "src/lib/brand.ts", "docs/PROJECT-STATUS.md"],
  },
  {
    type: "workflow",
    content:
      "TTS on mobile uses a silent audio keepalive in audioUnlock.ts (startAudioSession) for iOS autoplay — this pauses background music. TtsReadOnlyToggle ('Nur lesen') disables the audio session so users can read with Spotify etc. Settings in ttsPlaybackSettings.ts (loadTtsReadOnly).",
    concepts: [
      "tts",
      "mobile",
      "nur-lesen",
      "audio-session",
      "ios",
      "background-music",
    ],
    files: [
      "src/lib/tts/audioUnlock.ts",
      "src/components/TtsReadOnlyToggle.tsx",
      "src/lib/storage/ttsPlaybackSettings.ts",
    ],
  },
  {
    type: "architecture",
    content:
      "Chapter features: chapterCompletionProgress() in autoChapter.ts, ChapterProgressBar in chat, exportChapterAudioFromCloud() merges cloud-stored MP3s per chapter. Beta billing uses user_profiles tiers free/beta/pro with limits in BETA_TIER_* env and admin UI at /admin.",
    concepts: [
      "chapter",
      "chapter-audio-export",
      "beta-billing",
      "tier-limits",
    ],
    files: [
      "src/lib/chapter/autoChapter.ts",
      "src/lib/audio/chapterAudioExport.ts",
      "docs/BETA-BILLING.md",
      "src/app/admin/page.tsx",
    ],
  },
  {
    type: "workflow",
    content:
      "Fish TTS on Vercel: default beta provider. Upstream Fish 401/403 maps to HTTP 502 with code fish_auth (not session 401). Session missing uses 401 + code session_required. Fish emotion tags via fishAudioDelivery.ts; ambience/music/SFX play client-side in soundscape.ts/sfxPlayer.ts — not baked into Fish MP3. Generative Fish SFX deferred to offline pipeline → Supabase later.",
    concepts: ["fish-tts", "soundscape", "fish_auth", "tts-errors", "audiobook"],
    files: [
      "src/app/api/tts/fish/route.ts",
      "src/lib/tts/fishAudioDelivery.ts",
      "src/lib/audio/soundscape.ts",
      "docs/FISH-AUDIOBOOK.md",
    ],
  },
  {
    type: "workflow",
    content:
      "Bilingual library: every template exists as DE+EN pair in libraryTemplateTwins.ts (20 twins, 40 templates total). UI locale filter + i18n in src/lib/i18n/. Auth: separate /login and /signup pages (not combined). Mixed-speaker dialogue: quotes inside <<speaker:protagonist>> blocks need per-quote attribution via dialogueSpeakerInference.ts heuristics + optional LLM — not blind script_tag assignment.",
    concepts: [
      "bilingual",
      "library",
      "dialogue-attribution",
      "login",
      "signup",
      "speaker-blocks",
    ],
    files: [
      "src/lib/story/libraryTemplateTwins.ts",
      "src/lib/chat/dialogueSpeakerInference.ts",
      "src/app/login/page.tsx",
      "src/app/signup/page.tsx",
    ],
  },
  {
    type: "architecture",
    content:
      "Master project knowledge doc: docs/PROJECT-STATUS.md (status, learnings, P0-P2 open steps, future phases). Experimental local-only: image-studio/ (SDXL port 5125), samples/omnivoice/, LokalAI repo d:\\LokalAI (ports 8765/8766, separate from RP Audiobook). Image gen removed from main app; /dev/image-generator redirects to image-studio.",
    concepts: [
      "project-status",
      "image-studio",
      "omnivoice",
      "lokalai",
      "experimental",
      "documentation",
    ],
    files: [
      "docs/PROJECT-STATUS.md",
      "docs/EXPERIMENTAL-LOCAL.md",
      "image-studio/README.md",
      "AGENTS.md",
    ],
  },
  {
    type: "workflow",
    content:
      "iOS TTS autoplay (May 2026): preferHtmlMediaPlayback() uses one shared HTMLAudioElement (sharedTtsHtmlAudio.ts). TtsAutoplayQueue serializes clips; prepare()/prewarm loads blobs only — bindSharedTtsSource runs at play() time so prewarm does not skip bubbles. audioUnlock setTtsContentPlaying pauses silent keepalive during real TTS. Drive mode: ChatView runDriveMode + playTurnForDrive.",
    concepts: [
      "ios",
      "tts-autoplay",
      "shared-audio",
      "drive-mode",
      "prewarm",
      "mobile",
    ],
    files: [
      "src/lib/tts/sharedTtsHtmlAudio.ts",
      "src/lib/tts/ttsAutoplayQueue.ts",
      "src/lib/tts/audioUnlock.ts",
      "src/components/MessageAudioPlayer.tsx",
      "src/components/ChatView.tsx",
    ],
  },
  {
    type: "architecture",
    content:
      "Admin provider pricing (migration 017_provider_pricing.sql): per-model LLM/TTS cost USD + markup in admin UI. Server module providerPricing.ts; billing charges use provider rates. PWA: PwaInstallBanner + manifest. Library filters by UI locale (DE/EN header), no All/DE/EN toggle.",
    concepts: [
      "provider-pricing",
      "admin",
      "billing",
      "pwa",
      "library-locale",
      "migration-017",
    ],
    files: [
      "supabase/migrations/017_provider_pricing.sql",
      "src/lib/server/providerPricing.ts",
      "src/app/admin/page.tsx",
      "src/components/PwaInstallBanner.tsx",
      "src/lib/story/libraryTemplates.ts",
    ],
  },
  {
    type: "workflow",
    content:
      "Script-block TTS voices: segmentsFromScriptBlocks + splitCastBlockForTts — only quoted dialogue uses character voice; unquoted prose in <<speaker:cast>> blocks uses narrator. Fish chunk limit 2350 chars. scriptBlocksNeedMultiVoice skips cloud audioStoragePath (multi-voice resynth).",
    concepts: [
      "multi-voice",
      "script-blocks",
      "fish-tts",
      "cast-voices",
      "narrator",
    ],
    files: [
      "src/lib/tts/narratorTts.ts",
      "src/app/api/tts/fish/route.ts",
    ],
  },
  {
    type: "architecture",
    content:
      "Master agent index: AGENTS.md at repo root — routes, API map, src/lib index, TTS flows, migrations 001-017, commands. PROJECT-STATUS.md for human-oriented status and P0-P2 checklists.",
    concepts: [
      "agents-md",
      "codebase-index",
      "documentation",
      "project-status",
    ],
    files: ["AGENTS.md", "docs/PROJECT-STATUS.md", "docs/README.md"],
  },
  {
    type: "workflow",
    content:
      "Beta launch blockers (P0): full prod smoke test (docs/SMOKE-TEST.md), Supabase migrations 001-017 on prod including 017_provider_pricing.sql, content audit library templates (docs/BETA-CONTENT-LEGAL.md), valid Fish API key on Vercel, invite workflow tested, free-tier models in BETA_TIER_FREE_MODELS. Legal pages and BetaOnboardingModal exist.",
    concepts: [
      "beta-launch",
      "smoke-test",
      "release",
      "content-audit",
      "invite-only",
      "wallet",
    ],
    files: [
      "docs/PROJECT-STATUS.md",
      "docs/BETA-LAUNCH-PLAN.md",
      "docs/SMOKE-TEST.md",
      "docs/BETA-CONTENT-LEGAL.md",
      "src/components/BetaOnboardingModal.tsx",
    ],
  },
  {
    type: "preference",
    content:
      "User prefers German UI copy, minimal scoped diffs, no git commits unless explicitly asked. Image Studio lives in image-studio/ as a separate local project (SDXL + Vite), not deployed with main app. OmniVoice scripts are experimental local TTS, out of beta scope.",
    concepts: [
      "conventions",
      "image-studio",
      "omnivoice",
      "git",
      "german-ui",
    ],
    files: ["image-studio/README.md", "AGENTS.md", "package.json"],
  },
];

async function remember(entry) {
  const res = await fetch(`${BASE}/agentmemory/remember`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project: PROJECT,
      content: entry.content,
      type: entry.type,
      concepts: entry.concepts,
      files: entry.files,
    }),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`remember failed (${res.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

async function health() {
  const res = await fetch(`${BASE}/agentmemory/health`, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`health ${res.status}`);
  return res.json();
}

async function main() {
  console.log(`Checking agentmemory at ${BASE}…`);
  await health();
  console.log(`Seeding ${memories.length} memories for project "${PROJECT}"…`);
  for (const m of memories) {
    const result = await remember(m);
    const id = result?.memory?.id || result?.id || "ok";
    console.log(`  ✓ [${m.type}] ${id}`);
  }
  console.log("Done. Viewer: http://localhost:3113");
}

main().catch((err) => {
  console.error(err.message || err);
  console.error("\nStart the server first:");
  console.error("  npx @agentmemory/agentmemory");
  console.error("  or:  ~\\start-agentmemory.ps1");
  process.exit(1);
});
