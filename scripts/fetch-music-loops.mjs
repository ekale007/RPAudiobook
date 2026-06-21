/** Re-download Kenney CC0 music loops into public/sfx/ (see CREDITS.md). */
import fs from "node:fs";
import path from "node:path";

const files = [
  ["Infinite Descent.ogg", "music_tension.ogg"],
  ["Night at the Beach.ogg", "music_calm.ogg"],
  ["Flowing Rocks.ogg", "music_mystery.ogg"],
];
const base =
  "https://www.gamesounds.xyz/Kenney's%20Sound%20Pack/Music%20Loops/Loops/";
const outDir = path.join(process.cwd(), "public", "sfx");

for (const [src, dst] of files) {
  const url = base + encodeURIComponent(src);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${src}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(path.join(outDir, dst), buf);
  console.log("wrote", dst, buf.length);
}
