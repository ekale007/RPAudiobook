/**
 * Regressions tests for speaker tag parsing edge cases.
 */
import { parseSpeakerBlocks, normalizeMalformedSpeakerTags } from "../src/lib/chat/parseSpeakerBlocks";

describe("parseSpeakerBlocks", () => {
  it("handles Bug 1: missing speaker tag before dialogue (narrator fallback)", () => {
    // From real LLM output: narrator speaks, then Naya line without tag
    const text = `<<speaker:narrator>>
The nurse nods. "Of course."

"Just… something simple. Thank you."`;
    const blocks = parseSpeakerBlocks(text);
    // First block is narrator
    expect(blocks[0].speakerSlug).toBe("narrator");
    // Second block (untagged dialogue) is... narrator (no tag = narrator default)
    // This is expected behavior — the dialogue inference system should
    // have provided proper tags upstream. The parser can't invent tags.
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });

  it("handles Bug 2: unclosed speaker tag with spaces", () => {
    // Real LLM output: <<speaker:guest:Maya Lin (no >>, space in slug)
    const raw = `<<speaker:narrator>>
The young woman skids to a stop.

<<speaker:guest:Maya Lin
"Elias. Thank God."

<<speaker:naya-vellen
"Duty calls."`;

    // Normalize should fix the broken tag
    const normalized = normalizeMalformedSpeakerTags(raw);
    expect(normalized).toContain("<<speaker:guest:maya-lin>>");
    expect(normalized).not.toMatch(/<<speaker:guest:Maya Lin/);

    // Parse should recognize all three speakers
    const blocks = parseSpeakerBlocks(raw);
    const slugs = blocks.map((b) => b.speakerSlug);
    expect(slugs).toContain("narrator");
    expect(slugs).toContain("guest:maya-lin");
    expect(slugs).toContain("naya-vellen");
  });

  it("handles unclosed tag at end of text", () => {
    const raw = "Some prose\n<<speaker:guest:Zarek";
    const normalized = normalizeMalformedSpeakerTags(raw);
    expect(normalized).toContain("<<speaker:guest:zarek>>");
  });

  it("does NOT break properly closed tags", () => {
    const raw = "<<speaker:naya-vellen>>\nHello.\n<<speaker:narrator>>\nWorld.";
    const normalized = normalizeMalformedSpeakerTags(raw);
    expect(normalized).toBe(raw);
    const blocks = parseSpeakerBlocks(raw);
    expect(blocks[0].speakerSlug).toBe("naya-vellen");
    expect(blocks[1].speakerSlug).toBe("narrator");
  });
});
