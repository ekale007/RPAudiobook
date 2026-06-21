# Deployment-Modi — SaaS (Vercel) + Local-First (OSS)

Wie **rp-audiobook.vercel.app** normal weiterläuft, während Local-First/OSS **nicht identisch** sein muss.

---

## 1. Grundprinzip: ein Repo, zwei Modi

**Kein Feature-Paritäts-Zwang.** Ein Codebase, zur Laufzeit (und auf Vercel nur per Env) unterschiedliche **Deployment-Modi**:

| Modus | Env (geplant) | Wer nutzt es |
|-------|----------------|--------------|
| **SaaS** | Supabase + Server-Keys auf Vercel (Default wenn Supabase gesetzt) | rp-audiobook.vercel.app |
| **Local** | `NEXT_PUBLIC_DEPLOYMENT_MODE=local` oder kein Supabase + explizit Local | OSS-Nutzer, `npm run dev` |

Zentraler Schalter (Implementierung L1):

```ts
// src/lib/deploymentMode.ts (geplant)
export function deploymentMode(): "saas" | "local" {
  if (process.env.NEXT_PUBLIC_DEPLOYMENT_MODE === "local") return "local";
  if (isSupabaseConfigured()) return "saas";
  return "local"; // kein Supabase → Local-First
}
export function isSaasMode() => deploymentMode() === "saas";
export function isLocalMode() => deploymentMode() === "local";
```

UI und API prüfen **einen** Ort — keine verstreuten `if (supabase)`-Sonderfälle.

---

## 2. Was auf Vercel **immer** so bleibt

Vercel Production Env (unverändert):

- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENROUTER_API_KEY`, `FISH_AUDIO_API_KEY`, …
- Stripe, Wallet, Admin
- **Nicht** setzen: `NEXT_PUBLIC_DEPLOYMENT_MODE=local`

→ Build erkennt automatisch **SaaS** (Supabase vorhanden). Local-Only-Pfade sind tot oder irrelevant.

Preview-Deployments auf Vercel: gleiche Env wie Prod (oder Subset) — weiterhin SaaS.

---

## 3. Was lokal / OSS **anders** sein kann

| Bereich | SaaS | Local-First |
|---------|------|-------------|
| Auth | Supabase Login | Kein Login |
| Stories | Supabase + optional IndexedDB (EPUB) | Nur IndexedDB |
| Wallet / Stripe | An | Aus |
| `/admin` | An (ADMIN_USER_IDS) | Aus / 404 |
| LLM | Server-Proxy + Billing | Ollama, Client-OpenRouter |
| Turn-Audio Cloud | Supabase Storage | IndexedDB / lokal |
| Rate Limits / `requireSpendableBalance` | An | Aus |
| Features nur SaaS | z. B. Sync, Wallet-Top-up | — |
| Features nur Local | Ollama, Offline-Betrieb | — |

**Neue Local-Features** hinter `isLocalMode()` — **nicht** in SaaS-Pfad.  
**Neue SaaS-Features** hinter `isSaasMode()` — OSS-Build bleibt ohne diese UI, API bleibt geschützt durch Auth/Billing.

---

## 4. Branch-Strategie (empfohlen)

| Branch | Zweck |
|--------|--------|
| `master` / `main` | Einzige Integrationslinie — **Vercel deployt hier** |
| Feature-Branches | `feat/local-only`, `feat/ollama` — Merge nach Review |
| **Kein** dauerhafter `oss-only` Branch nötig | Env trennt die Modi |

Ablauf:

1. Local-First in Feature-Branch entwickeln + `npm run build` mit **beiden** Env-Sets testen (siehe unten).
2. Merge nach `main` → Vercel Auto-Deploy = SaaS bleibt wie heute.
3. GitHub Release / Tag = OSS-Snapshot (gleicher Commit wie Prod).

**Identische Features nicht erforderlich** — nur: SaaS-Pfad darf nicht regressieren.

---

## 5. Test-Matrix vor jedem Merge (kurz)

```powershell
# A) SaaS-Simulation (wie Vercel)
# .env.local mit Supabase + ohne LOCAL_ONLY
npm run build && npm run start
# → Login, Chat, TTS, Wallet smoke

# B) Local-First
# .env.local: NEXT_PUBLIC_DEPLOYMENT_MODE=local (ohne Supabase)
npm run dev
# → Kein Login, IndexedDB, Ollama/TTS lokal
```

Optional CI (später): zwei Build-Jobs mit unterschiedlichen Env-Fixtures.

---

## 6. API-Routes: sicher trennen

| Route | SaaS | Local |
|-------|------|-------|
| `/api/llm/chat` | Auth + Wallet | Optional: nur wenn `isSaasMode()` auf Server; Local nutzt Ollama/Client direkt |
| `/api/billing/*` | Ja | `404` oder „not available in local mode“ |
| `/api/admin/*` | Ja | `404` |
| `/api/tts/fish` | Auth + Wallet | Local: Client-Key oder lokaler TTS |

Server-Code am Anfang:

```ts
if (process.env.DEPLOYMENT_MODE === "local") {
  return NextResponse.json({ error: "local deployment" }, { status: 404 });
}
```

Oder: Local ruft Cloud-TTS **direkt vom Browser** mit User-Key (wie OpenRouter heute schon teilweise).

---

## 7. Was du **nicht** brauchst

- Zwei Repos für gleiche App (Wartungsalb)
- Feature-Parität als Release-Kriterium
- Local-Only Code in Vercel Env aktivieren
- Fork-Nutzer zwingen zu Supabase

---

## 8. Risiken & Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
|--------|----------------|
| `listStories()` ruft immer `createClient()` | SaaS-Pfad nur in `isSaasMode()` |
| Local-UI bricht SaaS-Chat | Shared Components, Mode an den Rändern |
| OSS-Nutzer erwarten Wallet | README: „Hosted vs Local“ |
| Vercel Build bricht durch Local-Only Types | `build` immer mit SaaS-Env in CI |

---

## 9. Kurzantwort

**Vercel läuft weiter**, weil:

1. Prod-Env = Supabase + Keys → automatisch **SaaS-Modus**
2. Local-First = zusätzliche Pfade, alte SaaS-Pfade bleiben Default
3. Ein `main`-Branch, kein Zwang zur Feature-Gleichheit
4. Vor Merge: einmal SaaS-Smoke + einmal Local-Smoke

Siehe auch: [LOCAL-FIRST.md](./LOCAL-FIRST.md), [DEPLOY.md](./DEPLOY.md)
