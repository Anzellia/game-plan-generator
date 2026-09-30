export const SUPPORTED_MODELS = {
  openai: ["gpt-5.6-sol", "gpt-5.6", "gpt-5.6-terra", "gpt-5.6-luna"],
  anthropic: ["claude-fable-5-1", "claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-4-5"],
  google: ["gemini-3.1-pro", "gemini-3.8-flash", "gemini-3.5-flash-lite"],
  xai: ["grok-4.7", "grok-4.6", "grok-4.5", "grok-4.20-0309-reasoning"],
  deepseek: ["deepseek-v4-pro", "deepseek-flash"],
} as const;

export type ProviderId = keyof typeof SUPPORTED_MODELS;

export function isProviderId(value: string): value is ProviderId {
  return Object.prototype.hasOwnProperty.call(SUPPORTED_MODELS, value);
}

export function isSupportedModel(provider: ProviderId, model: string): boolean {
  return (SUPPORTED_MODELS[provider] as readonly string[]).includes(model);
}

export type ModelErrorCode =
  | "API_KEY_REJECTED"
  | "MODEL_UNAVAILABLE"
  | "RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "TIMEOUT"
  | "INVALID_RESPONSE"
  | "UPSTREAM_ERROR";

export class ModelRequestError extends Error {
  constructor(
    public readonly code: ModelErrorCode,
    public readonly status: number
  ) {
    super(code);
    this.name = "ModelRequestError";
  }
}

function providerError(status: number): ModelRequestError {
  if (status === 401 || status === 403) return new ModelRequestError("API_KEY_REJECTED", 401);
  if (status === 404) return new ModelRequestError("MODEL_UNAVAILABLE", 422);
  if (status === 429) return new ModelRequestError("RATE_LIMITED", 429);
  if (status >= 500) return new ModelRequestError("PROVIDER_UNAVAILABLE", 502);
  return new ModelRequestError("UPSTREAM_ERROR", 502);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function responseText(provider: ProviderId, payload: unknown): string {
  if (!isRecord(payload)) return "";

  if (provider === "anthropic") {
    const blocks = payload.content;
    return Array.isArray(blocks)
      ? blocks
          .filter(isRecord)
          .filter((block) => block.type === "text" && typeof block.text === "string")
          .map((block) => block.text as string)
          .join("\n")
      : "";
  }

  if (provider === "google") {
    const candidates = payload.candidates;
    const first = Array.isArray(candidates) ? candidates[0] : null;
    const content = isRecord(first) ? first.content : null;
    const parts = isRecord(content) ? content.parts : null;
    return Array.isArray(parts)
      ? parts
          .filter(isRecord)
          .filter((part) => typeof part.text === "string")
          .map((part) => part.text as string)
          .join("\n")
      : "";
  }

  const choices = payload.choices;
  const first = Array.isArray(choices) ? choices[0] : null;
  const message = isRecord(first) ? first.message : null;
  return isRecord(message) && typeof message.content === "string" ? message.content : "";
}

export async function generateWithModel(
  provider: ProviderId,
  model: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  let url: string;
  let headers: Record<string, string>;
  let body: object;

  if (provider === "anthropic") {
    url = "https://api.anthropic.com/v1/messages";
    headers = {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    };
    body = {
      model,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    };
  } else if (provider === "google") {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    headers = { "Content-Type": "application/json", "x-goog-api-key": apiKey };
    body = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8192 },
    };
  } else {
    const baseUrl =
      provider === "openai"
        ? "https://api.openai.com/v1"
        : provider === "xai"
          ? "https://api.x.ai/v1"
          : "https://api.deepseek.com/v1";
    url = `${baseUrl}/chat/completions`;
    headers = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
    body = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw providerError(response.status);

    const payload: unknown = await response.json();
    const text = responseText(provider, payload).trim();
    if (!text) throw new ModelRequestError("INVALID_RESPONSE", 502);
    return text;
  } catch (error) {
    if (error instanceof ModelRequestError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ModelRequestError("TIMEOUT", 504);
    }
    // Do not log the request or the provider response: both can contain a user-supplied key.
    throw new ModelRequestError("PROVIDER_UNAVAILABLE", 502);
  } finally {
    clearTimeout(timeout);
  }
}