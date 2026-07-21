/**
 * Smoke tests for the billing subsystem.
 *
 * These run against the compiled TypeScript and verify that the core
 * billing functions compute costs correctly without hitting any external
 * APIs or databases.
 */
import { estimateLlmCostCents, fallbackUsageEstimate } from "../src/lib/server/llmUsage";
import { applyMarkupPercent } from "../src/lib/server/providerPricing";
import { buildStoryMemorySectionsDetailed } from "../src/lib/memory/storyMemory";
import type { StoryPlotState } from "../src/lib/memory/plotState";
import type { StoryTimeline } from "../src/lib/memory/storyTimeline";
import type { ReflectionsContainer } from "../src/lib/memory/reflections";

describe("promptBudget", () => {
  const emptyPlot: StoryPlotState = {
    version: 1,
    updatedAt: new Date().toISOString(),
    timeLabel: "Day 1",
    location: "The Keep",
    presentCharacters: [],
    absentCharacters: [],
    scheduledEvents: [],
    threats: [],
    resolvedFacts: [],
    openThreads: [],
    publicKnowledge: [],
  };
  const emptyTimeline: StoryTimeline = { version: 1, updatedAt: new Date().toISOString(), currentTime: "Day 1", events: [] };
  const emptyReflections: ReflectionsContainer = { version: 1, reflections: [] };

  it("does not trim mandatory layers (plot + timeline + rules)", () => {
    const result = buildStoryMemorySectionsDetailed({
      plotState: emptyPlot,
      timeline: emptyTimeline,
      pinnedNotes: [],
      reflections: emptyReflections,
      budgetChars: 100,
    });
    const keptNames = result.budget.kept.map((l) => l.name);
    expect(keptNames).toContain("plot");
    expect(keptNames).toContain("timeline");
    expect(keptNames).toContain("rules");
  });

  it("drops soft layers when budget is tight", () => {
    const result = buildStoryMemorySectionsDetailed({
      plotState: emptyPlot,
      timeline: emptyTimeline,
      pinnedNotes: [],
      bandSummary: "A".repeat(8000),
      rollingSummary: "B".repeat(5000),
      reflections: emptyReflections,
      budgetChars: 2000,
    });
    expect(result.budget.changed).toBe(true);
    const keptNames = result.budget.kept.map((l) => l.name);
    expect(keptNames).toContain("plot");
    expect(keptNames).toContain("timeline");
    expect(keptNames).toContain("rules");
  });
});

describe("providerPricing", () => {
  it("applies markup correctly", () => {
    expect(applyMarkupPercent(100, 0)).toBe(100);
    expect(applyMarkupPercent(100, 20)).toBe(120);
    expect(applyMarkupPercent(100, 100)).toBe(200);
    expect(applyMarkupPercent(0, 50)).toBe(0);
  });
});

describe("llmUsage", () => {
  it("estimateLlmCostCents returns > 0 for known model", () => {
    const c = estimateLlmCostCents(1000, 500, "google/gemini-2.5-flash-lite");
    expect(c).toBeGreaterThan(0);
  });

  it("fallbackUsageEstimate returns valid shape", () => {
    const fb = fallbackUsageEstimate();
    expect(fb.promptTokens).toBeGreaterThan(0);
    expect(fb.completionTokens).toBeGreaterThan(0);
    expect(fb.costCents).toBeGreaterThan(0);
  });
});
