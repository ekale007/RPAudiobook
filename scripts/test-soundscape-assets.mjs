/** Validate SFX catalog files + soundscape resolver (no browser). */
import fs from "node:fs";
import path from "node:path";
import { SFX_CATALOG } from "../src/lib/audio/sfxCatalog.ts";
import { resolveTurnSound } from "../src/lib/audio/soundscape.ts";

const root = path.join(process.cwd(), "public");
let ok = true;

for (const entry of Object.values(SFX_CATALOG)) {
  const file = path.join(root, entry.path.replace(/^\//, ""));
  if (!fs.existsSync(file)) {
    console.error("MISSING", entry.path);
    ok = false;
    continue;
  }
  const stat = fs.statSync(file);
  if (stat.size < 1000) {
    console.error("TOO SMALL", entry.path, stat.size);
    ok = false;
  } else {
    console.log("OK", entry.id, entry.bus, stat.size);
  }
}

const resolved = resolveTurnSound({
  rawContent: "Sturm. <<music:tension>> <<sfx:rain>> <<sfx:door>>",
  storySettings: {
    recentTurnCount: 24,
    loreTokenBudget: 3500,
    qwenSceneInstructEnabled: true,
    plotState: {
      version: 1,
      updatedAt: new Date().toISOString(),
      location: "Turm im Regen",
      timeLabel: "Nacht",
      presentCharacters: [],
      absentCharacters: [],
      scheduledEvents: [],
      threats: [{ id: "t", label: "Jagd", status: "active" }],
      resolvedFacts: [],
      openThreads: [],
      publicKnowledge: [],
    },
  },
});

console.log("\nResolver sample:", JSON.stringify(resolved, null, 2));

if (resolved.music !== "music-tension") {
  console.error("Expected music-tension, got", resolved.music);
  ok = false;
}
if (!resolved.ambient.includes("rain")) {
  console.error("Expected rain in ambient");
  ok = false;
}
if (!resolved.oneShots.includes("door")) {
  console.error("Expected door in oneShots");
  ok = false;
}

process.exit(ok ? 0 : 1);
