import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const logs = [];
page.on("console", (msg) => logs.push(msg.text()));

await page.goto("http://localhost:3000/dev/soundscape", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Spannung + Regen + Tür" }).click();
await page.waitForTimeout(2500);

const decodeResults = await page.evaluate(async () => {
  const paths = [
    "/sfx/music_tension.ogg",
    "/sfx/music_calm.ogg",
    "/sfx/music_mystery.ogg",
    "/sfx/rain.wav",
    "/sfx/doorOpen_1.ogg",
  ];
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return { error: "no AudioContext" };
  const ctx = new Ctx();
  const out = [];
  for (const p of paths) {
    try {
      const res = await fetch(p);
      const ab = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(ab.slice(0));
      out.push({
        path: p,
        ok: true,
        duration: buf.duration,
        channels: buf.numberOfChannels,
      });
    } catch (e) {
      out.push({ path: p, ok: false, error: String(e) });
    }
  }
  await ctx.close();
  return { decoded: out };
});

const logText = await page.locator("ul").innerText();
console.log("Page log:\n", logText.split("\n").slice(0, 3).join("\n"));
console.log("\nWeb Audio decode:\n", JSON.stringify(decodeResults, null, 2));

await browser.close();

const failed =
  decodeResults.decoded?.some((d) => !d.ok) ||
  !logText.includes("music-tension") ||
  !logText.includes("rain");

if (failed) {
  console.error("Soundscape test FAILED");
  process.exit(1);
}
console.log("\nSoundscape test PASSED");
