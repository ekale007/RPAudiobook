export const LLM_COST_HEADER = "x-llm-cost-cents";
export const TTS_COST_HEADER = "x-tts-cost-cents";

export function readCostCentsHeader(
  res: Response,
  headerName: string,
): number | undefined {
  const raw = res.headers.get(headerName);
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
