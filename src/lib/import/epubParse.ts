import JSZip from "jszip";

export type EpubChapter = {
  index: number;
  title: string;
  text: string;
  charCount: number;
};

export type ParsedEpub = {
  title: string;
  creator: string | null;
  language: string | null;
  chapters: EpubChapter[];
  coverDataUrl: string | null;
  totalChars: number;
};

const MAX_EPUB_BYTES = 20 * 1024 * 1024;

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function stripHtmlToText(html: string): string {
  let out = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  out = out
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "");

  out = decodeXmlEntities(out)
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return out;
}

function normalizeZipPath(baseDir: string, href: string): string {
  const baseParts = baseDir ? baseDir.split("/").filter(Boolean) : [];
  const hrefParts = href.split("/").filter(Boolean);
  const stack = [...baseParts];
  for (const part of hrefParts) {
    if (part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

function opfDir(opfPath: string): string {
  const idx = opfPath.lastIndexOf("/");
  return idx >= 0 ? opfPath.slice(0, idx) : "";
}

function firstMatch(xml: string, pattern: RegExp): string | null {
  const m = xml.match(pattern);
  return m?.[1]?.trim() ?? null;
}

function allMatches(xml: string, pattern: RegExp): string[] {
  const out: string[] = [];
  for (const m of xml.matchAll(pattern)) {
    if (m[1]) out.push(m[1].trim());
  }
  return out;
}

function parseOpfMetadata(opfXml: string): {
  title: string;
  creator: string | null;
  language: string | null;
} {
  const title =
    firstMatch(opfXml, /<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i) ??
    firstMatch(opfXml, /<title[^>]*>([\s\S]*?)<\/title>/i) ??
    "Unbenanntes Buch";
  const creator =
    firstMatch(opfXml, /<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i) ??
    firstMatch(opfXml, /<creator[^>]*>([\s\S]*?)<\/creator>/i);
  const language =
    firstMatch(opfXml, /<dc:language[^>]*>([\s\S]*?)<\/dc:language>/i) ??
    firstMatch(opfXml, /<language[^>]*>([\s\S]*?)<\/language>/i);
  return {
    title: decodeXmlEntities(title.replace(/\s+/g, " ").trim()),
    creator: creator
      ? decodeXmlEntities(creator.replace(/\s+/g, " ").trim())
      : null,
    language: language?.split("-")[0]?.toLowerCase() ?? null,
  };
}

function parseManifest(
  opfXml: string,
): Map<string, { href: string; mediaType: string }> {
  const map = new Map<string, { href: string; mediaType: string }>();
  const itemRe =
    /<item\b[^>]*\bid=["']([^"']+)["'][^>]*>/gi;
  for (const m of opfXml.matchAll(itemRe)) {
    const tag = m[0];
    const id = m[1];
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    const mediaType =
      tag.match(/\bmedia-type=["']([^"']+)["']/i)?.[1] ?? "";
    if (id && href) map.set(id, { href, mediaType });
  }
  return map;
}

function parseSpineIds(opfXml: string): string[] {
  const ids: string[] = [];
  const spineRe =
    /<itemref\b[^>]*\bidref=["']([^"']+)["'][^>]*\/?>/gi;
  for (const m of opfXml.matchAll(spineRe)) {
    if (m[1]) ids.push(m[1]);
  }
  return ids;
}

function chapterTitleFromHtml(html: string, fallback: string): string {
  const h = html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)?.[1];
  if (h) {
    const t = stripHtmlToText(h).replace(/\s+/g, " ").trim();
    if (t.length > 0 && t.length < 120) return t;
  }
  return fallback;
}

async function readZipText(
  zip: JSZip,
  path: string,
): Promise<string | null> {
  const file = zip.file(path);
  if (!file) return null;
  return file.async("string");
}

async function findOpfPath(zip: JSZip): Promise<string> {
  const container = await readZipText(zip, "META-INF/container.xml");
  if (!container) {
    throw new Error("Keine META-INF/container.xml — kein gültiges EPUB.");
  }
  const opf =
    firstMatch(container, /full-path=["']([^"']+)["']/i) ??
    firstMatch(container, /full-path=([^>\s]+)/i);
  if (!opf) throw new Error("OPF-Pfad in container.xml nicht gefunden.");
  return decodeXmlEntities(opf);
}

async function loadCoverDataUrl(
  zip: JSZip,
  opfXml: string,
  opfPath: string,
): Promise<string | null> {
  const coverId =
    firstMatch(opfXml, /<meta[^>]+name=["']cover["'][^>]+content=["']([^"']+)["']/i) ??
    firstMatch(opfXml, /<item[^>]+properties=["'][^"']*cover-image[^"']*["'][^>]+id=["']([^"']+)["']/i);
  if (!coverId) return null;
  const manifest = parseManifest(opfXml);
  const item = manifest.get(coverId);
  if (!item?.href) return null;
  const path = normalizeZipPath(opfDir(opfPath), item.href);
  const file = zip.file(path);
  if (!file) return null;
  const blob = await file.async("blob");
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

/** Parse an EPUB file entirely in the browser (no server upload). */
export async function parseEpubFile(file: File): Promise<ParsedEpub> {
  if (!file.name.toLowerCase().endsWith(".epub")) {
    throw new Error("Bitte eine .epub-Datei wählen.");
  }
  if (file.size > MAX_EPUB_BYTES) {
    throw new Error("EPUB ist zu groß (max. 20 MB für den Import).");
  }

  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const opfPath = await findOpfPath(zip);
  const opfXml = await readZipText(zip, opfPath);
  if (!opfXml) throw new Error("OPF-Manifest konnte nicht gelesen werden.");

  const meta = parseOpfMetadata(opfXml);
  const manifest = parseManifest(opfXml);
  const spineIds = parseSpineIds(opfXml);
  const base = opfDir(opfPath);

  const chapters: EpubChapter[] = [];
  let chapterIndex = 0;

  for (const id of spineIds) {
    const item = manifest.get(id);
    if (!item) continue;
    const media = item.mediaType.toLowerCase();
    if (
      !media.includes("html") &&
      !media.includes("xml") &&
      !item.href.endsWith(".xhtml") &&
      !item.href.endsWith(".html")
    ) {
      continue;
    }
    const path = normalizeZipPath(base, item.href);
    const raw = await readZipText(zip, path);
    if (!raw) continue;
    const text = stripHtmlToText(raw);
    if (text.length < 80) continue;
    chapters.push({
      index: chapterIndex,
      title: chapterTitleFromHtml(
        raw,
        `Kapitel ${chapterIndex + 1}`,
      ),
      text,
      charCount: text.length,
    });
    chapterIndex++;
  }

  if (!chapters.length) {
    throw new Error(
      "Kein lesbarer Text im EPUB gefunden (DRM oder ungewöhnliches Format?).",
    );
  }

  const coverDataUrl = await loadCoverDataUrl(zip, opfXml, opfPath);

  return {
    title: meta.title,
    creator: meta.creator,
    language: meta.language,
    chapters,
    coverDataUrl,
    totalChars: chapters.reduce((s, c) => s + c.charCount, 0),
  };
}

/** Build a bounded excerpt for LLM analysis from selected chapter onward. */
export function buildEpubExcerpt(
  parsed: ParsedEpub,
  opts?: { startChapterIndex?: number; maxChars?: number },
): string {
  const start = Math.max(
    0,
    Math.min(
      opts?.startChapterIndex ?? 0,
      parsed.chapters.length - 1,
    ),
  );
  const maxChars = opts?.maxChars ?? 28_000;
  const parts: string[] = [];
  let used = 0;

  for (let i = start; i < parsed.chapters.length && used < maxChars; i++) {
    const ch = parsed.chapters[i];
    const header = `=== ${ch.title} ===`;
    const budget = maxChars - used - header.length - 4;
    if (budget <= 0) break;
    const slice =
      ch.text.length <= budget
        ? ch.text
        : `${ch.text.slice(0, budget)}…`;
    parts.push(`${header}\n${slice}`);
    used += header.length + slice.length + 2;
  }

  return parts.join("\n\n");
}

export function guessEpubLocale(parsed: ParsedEpub): "de" | "en" {
  if (parsed.language === "de") return "de";
  if (parsed.language === "en") return "en";
  const sample = parsed.chapters[0]?.text.slice(0, 2000) ?? "";
  const deHints =
    (sample.match(/\b(und|der|die|das|nicht|sich|ein|eine)\b/gi) ?? []).length;
  const enHints =
    (sample.match(/\b(the|and|you|was|his|her|with|that)\b/gi) ?? []).length;
  return deHints >= enHints ? "de" : "en";
}
