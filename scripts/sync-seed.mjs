/**
 * Copy character/lore JSON into the bundled library seed folder.
 * Usage: node scripts/sync-seed.mjs "D:\path\to\character-cards"
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source =
  process.argv[2] ?? "";

if (!existsSync(source)) {
  console.error("Source not found:", source);
  console.error('Usage: node scripts/sync-seed.mjs "D:\\path\\to\\source-folder"');
  process.exit(1);
}

const targets = [join(root, "src", "data", "seed", "library")];

for (const base of targets) {
  mkdirSync(join(base, "characters"), { recursive: true });
  mkdirSync(join(base, "lorebooks"), { recursive: true });
  cpSync(join(source, "characters"), join(base, "characters"), {
    recursive: true,
  });
  cpSync(join(source, "lorebooks"), join(base, "lorebooks"), {
    recursive: true,
  });
}

console.log("Synced seed from", source);
