import type { OpenRouterSettings } from "@/lib/types";

export interface StreamCallbacks {
  onToken: (text: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export async function streamOpenRouterChat(
  settings: OpenRouterSettings,
  messages: Array<{ role: string; content: string }>,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        typeof window !== "undefined" ? window.location.origin : "",
      "X-Title": "HörbuchKI",
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      max_tokens: settings.maxTokens,
      temperature: settings.temperature,
      stream: true,
    }),
    signal,
  });

  if (!res.ok) {
    const body = await res.text();
    callbacks.onError(new Error(`OpenRouter ${res.status}: ${body}`));
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    callbacks.onError(new Error("No response body"));
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const json = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) callbacks.onToken(delta);
        } catch {
          /* skip malformed chunks */
        }
      }
    }
    callbacks.onDone();
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      callbacks.onDone();
      return;
    }
    callbacks.onError(e as Error);
  }
}

export async function completeOpenRouter(
  settings: OpenRouterSettings,
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        typeof window !== "undefined" ? window.location.origin : "",
      "X-Title": "HörbuchKI",
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      max_tokens: 1024,
      temperature: 0.5,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}
