/**
 * Engine 2A: memory-stream scoring logic tests (pure functions).
 */
import { cosineSimilarity } from "../src/lib/server/memoryStream";
import {
  buildStoryMemorySections,
  type MemoryStreamTurn,
} from "../src/lib/memory/storyMemory";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });

  it("returns ~0.94 for similar vectors", () => {
    const sim = cosineSimilarity([1, 0, 0], [1, 0.1, 0]);
    expect(sim).toBeGreaterThan(0.9);
  });

  it("handles zero vectors", () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });

  it("handles length mismatch", () => {
    expect(cosineSimilarity([1], [1, 2])).toBe(0);
  });
});

describe("memory-stream prompt layer", () => {
  it("skips layer when no turns", () => {
    const sections = buildStoryMemorySections({
      memoryStreamTurns: null,
    });
    expect(sections.join("\n")).not.toContain("Recovered memory");
  });

  it("includes retrieved turns with recency hint", () => {
    const turns: MemoryStreamTurn[] = [
      {
        content: "Kaelen lebt noch.",
        timestamp: new Date(Date.now() - 60_000).toISOString(),
        importance: 0.8,
      },
    ];
    const sections = buildStoryMemorySections({ memoryStreamTurns: turns });
    const joined = sections.join("\n");
    expect(joined).toContain("## Recovered memory");
    expect(joined).toContain("Kaelen lebt noch.");
  });

  it("orders multiple turns most relevant first (caller order preserved)", () => {
    const turns: MemoryStreamTurn[] = [
      { content: "A", timestamp: new Date().toISOString(), importance: 1 },
      { content: "B", timestamp: new Date().toISOString(), importance: 0.2 },
    ];
    const sections = buildStoryMemorySections({ memoryStreamTurns: turns });
    const joined = sections.join("\n");
    expect(joined.indexOf("- [just now] A")).toBeLessThan(
      joined.indexOf("- [just now] B"),
    );
  });
});