# RP-Audiobook Engine-Diagnose 2026-06-30

**Autor:** Hermes Agent (nach State-of-the-Art-Recherche 2024–2026)
**Status:** Analyse, KEIN Code geändert. Wartet auf User-Freigabe.
**Problemstellung (User):**
> "Story Gedächtnis und Story Timeline enthalten nur die letzen paar Infos, dadurch gehen andauernd in neuen Kapiteln Situationen wieder von vorne los oder nicht richtig. Die Story wird sehr unkontinuierlich. Wir müssen glaube ich allgemein an der Engine arbeiten."

---

## TL;DR

Die aktuelle Architektur ist **technisch solide** (4-Layer-Memory, Plot-State als Single-Source-of-Truth, Back-Compat-Envelope), aber **strukturell unzureichend** für Storys > 50 Turns / > 1 Kapitel. Die Wurzel des Problems ist **nicht** "zu wenig Memory" sondern **drei zusammenwirkende Defekte**:

1. **Rolling-Summary wird bei jedem Sync komplett neu generiert** aus 40 KB Transcript → nach 100 Turns verliert der Summary ältere Fakten, weil das LLM nicht alle Details behalten kann. Lost-in-the-middle.
2. **Es gibt keine Chapter-übergreifende Konsolidierung** (nur ein flacher `bandSummary`-String, der beim Kapitel-Abschluss entsteht).
3. **Plot-State und Timeline werden als zwei separate, unkoordinierte JSON-Extraktionen** gepflegt — sie können **divergieren** ("Kaelen ist verletzt" im Plot-State, aber Timeline sagt "Kaelen kämpft").

Die Forschung 2024–2026 zeigt klar: **"mehr Token" ist nicht die Lösung**. Die Lösung ist eine **Hierarchische Memory-Architektur** (mehrere Verdichtungs-Ebenen) **kombiniert** mit **Symbolic State Tracking** (Plot-State bleibt authoritative, nicht der LLM-Output).

---

## 1. Was wir heute haben

### Aktuelle Memory-Schichten

| Layer | Datei | Token-Budget | Inhalt |
|---|---|---|---|
| System-Prompt Setup | `lib/prompt/buildPrompt.ts` | ~1-2 KB | Character card, scenario (gekürzt ab Ch.3), instructions |
| Cast Memory (Char Sheets) | `lib/memory/characterMemory.ts` | variabel | Strukturiert pro Charakter (last location, attitude, relationships) |
| Plot State | `lib/memory/plotState.ts` | ~1-2 KB | timeLabel, location, presentCharacters, absentCharacters, scheduledEvents, threats, resolvedFacts, openThreads, publicKnowledge |
| Story Timeline | `lib/memory/storyTimeline.ts` | ~2-3 KB | Event-Stream mit type/actors/location/summary (max 6 new/sync) |
| Player Pins | `lib/memory/storyPins.ts` | variabel | Freitext-Notizen des Spielers |
| Band Summary | DB-Spalte | 1 Eintrag | Komplette Bogen-Zusammenfassung (entsteht beim Kapitel-Abschluss) |
| Prior Chapter Summaries | DB-Spalte | 1 Eintrag | Alle bisherigen Kapitel-Summaries |
| Rolling Summary | `lib/chapter/rollingSummary.ts` | ~280 Wörter (900 tokens) | In-chapter verdichteter State |
| Recent Turns | `buildPrompt.ts` | `settings.recentTurnCount` (Default?) | Letzte N Turns roh |

### Wie wird gesynct?

- **Plot State:** LLM-Extraktion aus `buildTranscript(turns, maxChars=42000)`. Komplette Re-Extraktion, merge mit `existing` (im LLM-Prompt).
- **Timeline:** LLM-Extraktion, append-only (max 6 new events). LLM bekommt existing JSON zum Weiterschreiben.
- **Rolling Summary:** **Regeneriert sich komplett** aus 40 KB Transcript bei jedem Sync (alle 2-4 Turns laut `interactive-fiction-memory` Skill).
- **Cast Memory:** LLM-Extraktion (siehe characterMemory.ts).

### Synapse: Plot-State als Authoritative?

Ja, in `storyMemory.ts` ist es klar definiert:
```
- **Plot state** (if present) overrides character card defaults, scenario text, and old countdown tags.
- The **most recent chat messages** in this request are the source of truth for what just happened.
- If any prose summary below conflicts with plot state or recent messages, **ignore the summary** for those facts.
```

→ Das ist **State of the Art** (vgl. ConStory-Bench: "facts most likely to be wrong"). ABER: Der **Rolling-Summary** ist nicht gegen Plot-State validiert, das LLM darf sich widersprechen.

---

## 2. Was die Forschung 2024-2026 sagt

### 2.1 ConStory-Bench: Wo gehen LLMs kaputt? (arXiv 2603.05890, 2026)

> "Consistency errors are most common in **factual** and **temporal** dimensions, tend to appear around the **middle of narratives**, occur in text segments with **higher token-level entropy**."

**Befund für RP-Audiobook:**
- **Faktisch:** "Kaelen ist verletzt" geht vergessen, Charakter-Eigenschaften verwaschen
- **Temporal:** "Invasion in 34h" wird mal "Invasion in 30h" mal "Invasion morgen" — wir haben Time-Label, aber **kein Countdown-Drift-Schutz**
- **Mitte:** Storys mit 100+ Turns verlieren ab Turn 50-70 dramatisch an Konsistenz

**Empfehlung der Autoren:** Long-Form-Generation braucht **externe Konsistenz-Layer** (z.B. structured memory + validation), nicht nur mehr Kontext.

### 2.2 Generative Agents (Stanford 2023, arXiv 2304.03442)

Das meistzitierte Architektur-Pattern für interaktive LLM-Agenten. Drei Bausteine:

1. **Memory Stream:** Append-only Liste aller Erlebnisse mit `{timestamp, importance_score, description, embedding}`
2. **Reflection:** Periodische Generierung höher-abstrakter Reflexionen ("Kaelen has become a trusted ally") aus Memory-Stream
3. **Retrieval:** 3-Faktor-Score bei jeder Abfrage:
   - **Recency** (exponential decay)
   - **Importance** (vom LLM beim Memory-Write vergeben, 1-10)
   - **Relevance** (Embedding-Cosine zum aktuellen Kontext)

**Was wir haben vs. was fehlt:**

| Komponente | Stanford | RP-Audiobook heute |
|---|---|---|
| Memory Stream | Append-only mit importance | ❌ Timeline ist append-only, aber KEIN importance-Score, keine embeddings |
| Reflection | LLM-generated higher-level insights | ❌ Komplett fehlend — wir haben nur "rolling summary", der flach ist |
| Retrieval | 3-Faktor gewichtet | ❌ Wir geben ALLES in den Prompt — keine Selektion |

### 2.3 Long Story Generation via Knowledge Graph (arXiv 2508.03137, 2025-08)

> "Multi-Agent Story Generator mit long-term memory storage (wichtigste Erinnerungen) + short-term memory storage (letzte Outlines). Theme-Obstacle-Framework basierend auf Narratology."

**Befund:** Outline-Based-Generation alleine leidet unter **theme drift**, weil das Modell "vergisst" was die ursprünglichen Outline-Punkte waren. Lösung: **Symbolic + Neural hybrid** — Knowledge-Graph speichert Entitäten/Beziehungen, LLM nutzt das beim Generieren.

**Was wir haben vs. was fehlt:**

- Wir haben Plot-State (JSON) — das ist eine **sehr begrenzte Form** von Knowledge-Graph (Charaktere + Threats + Events, aber keine Beziehungen)
- KEIN richtiger Graph (Beziehungen: "Kaelen-Liebe-zu-Lyra", "Vater-getötet-von-Lucier")
- KEIN Theme-Obstacle-Framework

### 2.4 From World-Gen to Quest-Line (arXiv 2604.25482, 2026-04) — DIREKT RELEVANT

> "Multi-stage prompt pipeline: World → NPCs → Player → Quest-Plan → Quest-Expansion. Jeder Stage bekommt structured JSON von vorheriger Stage."

**Befund für RPG:** Strukturelle Pipeline mit **explicit data flow** zwischen Stages reduziert narrative drift und hallucinations. Statt "LLM generiert alles auf einmal" → **staged generation with validation gates**.

**Was wir haben vs. was fehlt:**

- Wir haben Band/Chapter/Sub-Chapter (3 Ebenen) — gut!
- ABER: keine "Quest-Line" Planung zwischen Kapiteln
- ABER: keine Validation-Gates (LLM darf Plot-State und Timeline unabhängig voneinander falsch schreiben)

### 2.5 NexusSum: Hierarchical LLM Agents (arXiv 2505.24575, 2025-05)

> "Hierarchical multi-LLM summarization: chunk-level → section-level → book-level. +30% BERTScore F1 über Single-Pass-Summary."

**Befund:** Mehrstufige Verdichtung schlägt Single-Pass-Summary deutlich.

**Was wir haben:**

- Band Summary (Bogen-Ebene) + Rolling Summary (Kapitel-Ebene) + Recent Turns (sofort) — eigentlich DREI Ebenen
- ABER: Rolling Summary regeneriert sich FLACH aus 40 KB bei jedem Sync. Das ist NICHT hierarchisch, das ist single-pass.
- ABER: Band Summary entsteht nur beim Kapitel-Abschluss — wird nie aktualisiert zwischen Kapiteln

### 2.6 IVIE: Neuro-Symbolic Interactive Fiction (arXiv 2606.13348, 2026-06)

> "LLM generiert kreativ (Setting, Charaktere, Puzzles), symbolic validiert (Konsistenz, World-State). 4-Stage-Pipeline."

**Befund:** Hybrid Symbolic+Neural funktioniert: LLM für kreative Freiheit, Symbolic Layer für Konsistenz.

**Was wir haben:** Plot-State ist symbolic, aber es gibt **keine automatische Validierung** dass die LLM-Outputs (Antwort, Timeline) konsistent mit Plot-State sind.

### 2.7 Context Rot (arXiv 2606.29718, 2026-06)

> "Extensive context causes models to directly give up or prematurely provide uncertain answers."

**Befund:** Mehr Context ≠ bessere Antwort. Bei zu viel Kontext werden LLMs unzuverlässig.

**Was wir haben:** 40 KB Transcript + Plot-State + Timeline + Cast + Lore + Pins + Recent Turns → schnell 60-100 KB Prompt. Das ist in der "rot zone" für viele Modelle.

**Lösung der Paper:** Context-Management (was rein, was raus, komprimiert). Nicht "mehr reinstopfen".

---

## 3. Diagnose: Warum es bei uns bricht

### 3.1 Drei zusammenwirkende Defekte

#### Defekt 1: **Rolling-Summary Drift (HARD)**
`regenerateRollingSummary()` baut bei JEDEM Sync (alle 2-4 Turns) den Rolling-Summary aus den **letzten 40 KB Transcript** komplett neu. Nach 50 Turns:
- Transcript enthält 100+ Turns × ~500 chars = ~50 KB
- Wir nehmen 40 KB → schneiden Anfang ab
- LLM generiert 200-280 Wörter — passt nicht mal alles rein
- **Symptom:** "Kaelen ist verletzt" war in Turn 30, geht in Turn 80 verloren, weil 40 KB Transcript vorne abschneidet

**Lösung:** Hierarchische Verdichtung (Chunk-Summary → Chapter-Summary → Band-Summary), nicht single-pass.

#### Defekt 2: **Keine Cross-Chapter-Konsolidierung (HARD)**
`bandSummary` entsteht nur beim **finalizeChapter()** und wird **nie zwischen Kapiteln aktualisiert**. Wenn ein User Storys mit 5+ Kapiteln spielt, ist der Band-Summary statisch + der aktuelle Rolling-Summary hat nur 280 Wörter.

**Lösung:** Periodische Konsolidierung (z.B. nach jedem Chapter-Close oder alle 50 Turns):
- Rolling-Summary → Chapter-Summary (überschreibbar, frisch)
- Alle Chapter-Summaries → Band-Summary (rolling update, "what does the user know about the WHOLE story so far")

#### Defekt 3: **Plot-State und Timeline divergieren (MEDIUM)**
Zwei separate LLM-Calls, zwei separate JSONs, keine Validierung dass sie zueinander passen.
- Plot-State: "Kaelen verletzt im Lazarett" (absentCharacters)
- Timeline: "Kaelen kämpft im Thronsaal" (event)
- LLM-Generation akzeptiert beides

**Lösung:** Validation-Pass nach jeder Extraktion: "Prüfe ob alle Timeline-Events mit Plot-State konsistent sind. Wenn Konflikt: Plot-State gewinnt."

### 3.2 Sekundäre Defekte (MEDIUM/LOW)

| # | Defekt | Severity | Beispiel |
|---|---|---|---|
| 4 | **Kein Importance-Score** in Timeline-Events | MEDIUM | "Marcus hat einen Apfel gegessen" wird gleichwertig gespeichert wie "Marcus hat den König verraten" |
| 5 | **Keine Embeddings für semantische Retrieval** | MEDIUM | Wir geben ALLES in den Prompt, statt ähnliche vergangene Events zu retrieven |
| 6 | **Recent Turns sind roh** (nicht summarisiert) | MEDIUM | Bei 200 Turns gehen 80% der Token-Budget für "Recency" drauf, die vielleicht nicht die wichtigsten Turns sind |
| 7 | **Kein Reflection-Layer** | MEDIUM | "Kaelen has become a trusted ally" wird nirgends explizit gemacht — das LLM muss es aus scattered hints ableiten |
| 8 | **Character-Sheet-Updates sind dünn** | LOW | Cast-Sync läuft nur alle 6-8 Turns (laut Skill), aber wir haben kein "alter"-Tracking, wenn ein Charakter sich entwickelt |
| 9 | **Pin-System ist untagged** | LOW | Alle Pins sind gleichwertig — keine Kategorien (Lore, Quest, Reminder) |

### 3.3 Was wir RICHTIG machen

- ✅ **Plot-State als Authoritative Single-Source-of-Truth** (ConStory-Bench empfiehlt das)
- ✅ **Back-Compat-Envelope-Pattern** (veraltet zu JSON ohne Migration)
- ✅ **Separater Cast-Sync und Plot-State-Sync** (Pitfall aus Skill: "shared lock drops work")
- ✅ **Append-Only Timeline** mit max 6 new/sync (verhindert Explosion)
- ✅ **Rolling-Summary + Band-Summary sind getrennt** (gute Hierarchie-Idee, nur falsch umgesetzt)
- ✅ **Lore-Scanner** matched nur aktive Lore (Token-Budget-Management)
- ✅ **Restore-on-load via Envelope-Parser** (graceful degradation)

---

## 4. Lösungsvorschlag (3 Stufen)

### Stufe 1: Quick-Wins (1-2 Tage, ~500-800 LOC)

#### 1A. Hierarchische Verdichtung statt single-pass Rolling-Summary

**Statt:** Rolling-Summary komplett aus 40 KB regenerieren.
**Neu:** Chunk-Summaries (pro 10 Turns) → Chapter-Summary (aus allen Chunks) → Band-Summary (aus allen Chapters).

Implementation:
- Neues DB-Feld `chapter_chunks` (Array von `{startTurn, endTurn, summary}`)
- Bei jedem Plot-State-Sync: inkrementell neuen Chunk-Summary erzeugen
- Chapter-Summary = Konkatenation der Chunks + LLM-Pass für Kohärenz
- Band-Summary = Konsolidierung aller Chapter-Summaries (nur bei Chapter-Close oder alle 100 Turns)

#### 1B. Cross-Chapter-Konsolidierung

- `bandSummary` wird zwischen Kapiteln **nicht mehr komplett neu** geschrieben
- Statt: Inkrementelle Updates — neuer Band-Summary = LLM("Hier ist der alte Band-Summary. Hier ist das aktuelle Chapter-Summary. Integriere.")
- Vermeidet "statischer 2000-Wörter-Band-Summary" der mit Kapitel 5 hoffnungslos veraltet ist

#### 1C. Plot-State + Timeline Validation-Pass

- Nach jeder Extraktion: LLM-Check ("Sind alle Timeline-Events mit Plot-State konsistent? Wenn nein, korrigiere.")
- Nutzt kleines Modell (z.B. Haiku / 4B Flash)
- ODER: Programmlogik (declarative Rules) für offensichtliche Konflikte
  - Timeline-Event mit `actors: ["Kaelen"]` aber Plot-State says `absentCharacters: [{name: "Kaelen"}]` → Auto-Correction

#### 1D. Importance-Score für Timeline-Events

- Im Timeline-Schema: `importance: 0-1` (vom LLM vergeben, was ist "plot-critical" vs. "filler")
- Beim Aufbauen des Prompts: nur Events mit `importance >= 0.5` ins Detail, andere als "minor beat" zusammengefasst
- Spart Token-Budget für Wichtiges

### Stufe 2: Struktur-Verbesserungen (3-5 Tage, ~1500-2000 LOC)

#### 2A. Memory-Stream nach Stanford-Pattern

- Alle Chat-Turns in einen append-only `MemoryStream` mit `{turnId, timestamp, importance, embedding, content}`
- Beim Prompt-Build: **Retrieval** statt "alles rein"
- 3-Faktor-Score: Recency (0-1) × Importance (0-1) × Relevance (Embedding-Cosine, 0-1)
- Top-K Turns + alle "high-importance" Turns kommen in den Prompt
- Embeddings via OpenAI `text-embedding-3-small` oder lokal (Xenova/all-MiniLM-L6-v2)

#### 2B. Reflection-Layer

- Alle 30-50 Turns: LLM generiert "Reflections" (höher-abstrakte Zusammenfassung)
- "After 50 turns, the key character relationships are: Kaelen-Lyra (romance, deepening), Lyra-Marcus (rivalry), ..."
- "The main unresolved question is: Who betrayed the king? Three suspects remain: ..."
- Diese Reflections werden **vor** dem Plot-State in den Prompt gegeben

#### 2C. Knowledge-Graph (lightweight)

- Spalte `story_graph` (JSON) in DB
- Entitäten: Charaktere, Orte, Items, Concepts
- Beziehungen: `"Kaelen" -loves-> "Lyra"`, `"Vater" -killed_by-> "Lucier"`, `"Schwert" -located_at-> "Kaelen"`
- LLM extrahiert aus jedem Plot-State-Sync zusätzlich den Graph
- Beim Prompt-Build: relevanteste Beziehungen zur aktuellen Szene (Charaktere im Plot-State presentCharacters) → "Kaelen-Lyra: romantic partner" (1 Zeile statt scattered in 50 Turns)

### Stufe 3: Quality-of-Life (1-2 Tage, ~500 LOC)

#### 3A. Konflikt-Resolution-UI

- Wenn Validation-Pass einen Konflikt findet: User bekommt Notification ("Konflikt zwischen Timeline und Plot-State erkannt: Kaelen kämpft Thronsaal, aber Plot-State sagt Lazarett. Welches ist richtig?")
- 3 Buttons: "Plot-State behalten" / "Timeline überschreiben" / "Manuell korrigieren"
- Macht Konflikte **sichtbar** statt sie stillschweigend zu akzeptieren

#### 3B. Memory-Inspector Page

- Neue Page `/story/[id]/memory-inspector`
- Zeigt: alle Timeline-Events mit Importance, alle Plot-State-Felder, alle Reflections, Memory-Stream-Recent
- User kann manuell korrigieren (Plot-State-Editor haben wir schon, Timeline-Editor wäre neu)
- Macht das System **debuggable** für den User

#### 3C. Smart-Prompt-Budget

- Token-Budget pro Memory-Layer konfigurierbar (User-Settings)
- Beim Build: wenn Sum > Max, **largest-first truncation** mit Importance-Gewichtung
- Plot-State: nie truncaten (authoritative)
- Reflections: nie truncaten
- Timeline: nur Top-K Importance
- Cast: nur "present in scene" + 1-2 wichtigste
- Recent Turns: bleiben roh, aber weniger wenn andere Layer wachsen

---

## 5. Empfohlene Reihenfolge

| # | Was | Aufwand | Impact | Risiko |
|---|---|---|---|---|
| 1 | 1D: Importance-Score Timeline | 2h | Mittel | Niedrig (additive) |
| 2 | 1C: Plot-State + Timeline Validation | 4h | Hoch | Mittel (LLM kann over-correct) |
| 3 | 1A: Hierarchische Verdichtung | 1 Tag | **Sehr hoch** | Mittel (DB-Migration) |
| 4 | 1B: Cross-Chapter-Konsolidierung | 0.5 Tage | Hoch | Niedrig |
| 5 | 3A: Konflikt-Resolution-UI | 0.5 Tage | Mittel (UX) | Niedrig |
| 6 | 2A: Memory-Stream + Retrieval | 2 Tage | Sehr hoch | Mittel-Hoch (Embeddings + Retrieval-Logic) |
| 7 | 2B: Reflection-Layer | 1 Tag | Hoch | Mittel (LLM-Quality) |
| 8 | 2C: Knowledge-Graph | 2-3 Tage | Hoch | Hoch (komplex) |
| 9 | 3B: Memory-Inspector | 1 Tag | Mittel (Debug) | Niedrig |
| 10 | 3C: Smart-Prompt-Budget | 0.5 Tage | Mittel | Niedrig |

**Mein Vorschlag:** Starten mit **1 + 2 + 3 + 4** (Quick-Wins), das bringt 80% des Nutzens. Stufe 2 ist nice-to-have, kommt später.

---

## 6. Was ich empfehle — jetzt

**NICHT alle Änderungen auf einmal.** Das wäre riskant und schwer reviewable. Statt:

1. **User reviewt diese Diagnose** und entscheidet:
   - Welche Stufe(n) umsetzen?
   - In welcher Reihenfolge?
   - Soll ich mit 1D (Importance, 2h, niedrig-risiko) anfangen zum Warmwerden, oder gleich mit 1A+1B (Hierarchie, 1.5 Tage, hoher Impact)?
2. **Ich schreibe einen Implementierungs-Plan** mit bite-sized Tasks (siehe `writing-plans` Skill)
3. **Ein Task pro Session**, mit Test + Commit + Vercel-Deploy
4. **Wir messen vor/nach** mit einem konkreten Test-Story (z.B. "Kaelen verletzt sich in Turn 30, geht in Lazarett, kommt in Turn 80 zurück — erinnert sich das System?")

---

## 7. Quellen

1. **Lost in Stories: Consistency Bugs in Long Story Generation by LLMs** — arXiv 2603.05890 (2026-03)
2. **Long Story Generation via Knowledge Graph and Literary Theory** — arXiv 2508.03137 (2025-08)
3. **NARRA-Gym for Evaluating Interactive Narrative Agents** — arXiv 2605.08503 (2026-05)
4. **IVIE: Neuro-Symbolic Approach to Interactive Fiction** — arXiv 2606.13348 (2026-06)
5. **From World-Gen to Quest-Line: Dependency-Driven Prompt Pipeline for Coherent RPG Generation** — arXiv 2604.25482 (2026-04)
6. **NexusSum: Hierarchical LLM Agents for Long-Form Narrative Summarization** — arXiv 2505.24575 (2025-05)
7. **Diagnosing and Mitigating Context Rot in Long-horizon Search** — arXiv 2606.29718 (2026-06)
8. **Generative Agents: Interactive Simulacra of Human Behavior** (Stanford) — arXiv 2304.03442 (2023-04)
9. **intermediate-fiction-memory Skill** (RP-Audiobook) — `/home/ekale/.hermes/skills/software-development/interactive-fiction-memory/SKILL.md`
10. **rp-audiobook Skill** — `/home/ekale/.hermes/skills/rp-audiobook/SKILL.md`

---

**Stand:** 2026-06-30 17:30 · **Erstellt von:** Hermes Agent · **Nächste Aktion:** User-Review
