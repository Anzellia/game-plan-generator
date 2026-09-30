export const PROVIDER_IDS = ["openai", "anthropic", "google", "xai", "deepseek"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];
export type AvailableModel = { id: string; name: string };

// A custom ID can contain provider aliases and fine-tune separators, but never URL/query controls.
export function isValidModelId(value: string): boolean {
  return value.length > 0 && value.length <= 200 && /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(value);
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

function providerHeaders(provider: ProviderId, apiKey: string): Record<string, string> {
  if (provider === "anthropic") {
    return { "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
  }
  if (provider === "google") return { "x-goog-api-key": apiKey };
  return { Authorization: `Bearer ${apiKey}` };
}

async function requestJson(
  url: string,
  headers: Record<string, string>,
  body?: object,
  timeoutMs = 20_000
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: body ? { ...headers, "Content-Type": "application/json" } : headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
    if (!response.ok) throw providerError(response.status);
    return await response.json().catch(() => {
      throw new ModelRequestError("INVALID_RESPONSE", 502);
    });
  } catch (error) {
    if (error instanceof ModelRequestError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ModelRequestError("TIMEOUT", 504);
    }
    // Never log headers, request bodies, or upstream responses: they can contain a user key.
    throw new ModelRequestError("PROVIDER_UNAVAILABLE", 502);
  } finally {
    clearTimeout(timeout);
  }
}

function isTextModel(provider: ProviderId, item: Record<string, unknown>, id: string): boolean {
  if (provider === "openai") {
    return /^(gpt-|chatgpt-|o[1-9]\d*(?:$|[-.]))/i.test(id) &&
      !/(audio|realtime|transcrib|tts|image|embedding|moderation|search|speech|video|instruct)/i.test(id);
  }
  if (provider === "google") {
    return id.startsWith("gemini-") &&
      Array.isArray(item.supportedGenerationMethods) &&
      item.supportedGenerationMethods.includes("generateContent") &&
      !/(image|audio|video|tts|embedding|native-audio)/i.test(id);
  }
  if (provider === "xai") {
    return !Array.isArray(item.output_modalities) || item.output_modalities.includes("text");
  }
  return true;
}

function parseModels(provider: ProviderId, entries: unknown): AvailableModel[] {
  if (!Array.isArray(entries)) throw new ModelRequestError("INVALID_RESPONSE", 502);
  const models: AvailableModel[] = [];
  const seen = new Set<string>();
  for (const value of entries) {
    if (!isRecord(value)) continue;
    const rawId = provider === "google" && typeof value.name === "string"
      ? value.name.replace(/^models\//, "")
      : value.id;
    if (typeof rawId !== "string" || !isValidModelId(rawId) ||
        !isTextModel(provider, value, rawId) || seen.has(rawId)) continue;
    seen.add(rawId);
    const display = provider === "google" ? value.displayName : value.display_name;
    models.push({ id: rawId, name: typeof display === "string" && display.length <= 100 ? display : rawId });
    if (models.length === 200) break;
  }
  return models;
}

// This list is fetched for the user's key, rather than guessing IDs that may not exist.
export async function listProviderModels(provider: ProviderId, apiKey: string): Promise<AvailableModel[]> {
  const headers = providerHeaders(provider, apiKey);
  const entries: unknown[] = [];
  if (provider === "anthropic") {
    let afterId: string | undefined;
    for (let page = 0; page < 5; page++) {
      const url = new URL("https://api.anthropic.com/v1/models");
      url.searchParams.set("limit", "100");
      if (afterId) url.searchParams.set("after_id", afterId);
      const payload = await requestJson(url.toString(), headers);
      if (!isRecord(payload) || !Array.isArray(payload.data)) {
        throw new ModelRequestError("INVALID_RESPONSE", 502);
      }
      entries.push(...payload.data);
      if (!payload.has_more) break;
      if (typeof payload.last_id !== "string" || payload.last_id === afterId) {
        throw new ModelRequestError("INVALID_RESPONSE", 502);
      }
      afterId = payload.last_id;
    }
  } else if (provider === "google") {
    let pageToken: string | undefined;
    for (let page = 0; page < 5; page++) {
      const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
      url.searchParams.set("pageSize", "1000");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const payload = await requestJson(url.toString(), headers);
      if (!isRecord(payload) || (payload.models !== undefined && !Array.isArray(payload.models))) {
        throw new ModelRequestError("INVALID_RESPONSE", 502);
      }
      entries.push(...(payload.models ?? []));
      if (typeof payload.nextPageToken !== "string" || !payload.nextPageToken) break;
      if (payload.nextPageToken === pageToken) throw new ModelRequestError("INVALID_RESPONSE", 502);
      pageToken = payload.nextPageToken;
    }
  } else {
    const url = provider === "openai" ? "https://api.openai.com/v1/models"
      : provider === "xai" ? "https://api.x.ai/v1/language-models"
      : "https://api.deepseek.com/models";
    const payload = await requestJson(url, headers);
    if (!isRecord(payload)) throw new ModelRequestError("INVALID_RESPONSE", 502);
    const collection = provider === "xai" ? payload.models : payload.data;
    if (!Array.isArray(collection)) throw new ModelRequestError("INVALID_RESPONSE", 502);
    entries.push(...collection);
  }
  return parseModels(provider, entries);
}

function modelRequest(
  provider: ProviderId,
  model: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  probe: boolean
): { url: string; headers: Record<string, string>; body: object } {
  const headers = providerHeaders(provider, apiKey);
  if (provider === "anthropic") {
    return {
      url: "https://api.anthropic.com/v1/messages",
      headers,
      body: {
        model, max_tokens: probe ? 32 : 8192,
        ...(probe ? {} : { system: systemPrompt }),
        messages: [{ role: "user", content: userPrompt }],
      },
    };
  }
  if (provider === "google") {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      headers,
      body: {
        ...(probe ? {} : { systemInstruction: { parts: [{ text: systemPrompt }] } }),
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: probe
          ? { maxOutputTokens: 32 }
          : { responseMimeType: "application/json", maxOutputTokens: 8192 },
      },
    };
  }
  const baseUrl = provider === "openai" ? "https://api.openai.com/v1"
    : provider === "xai" ? "https://api.x.ai/v1" : "https://api.deepseek.com/v1";
  return {
    url: `${baseUrl}/chat/completions`,
    headers,
    body: {
      model,
      messages: [
        ...(probe ? [] : [{ role: "system", content: systemPrompt }]),
        { role: "user", content: userPrompt },
      ],
      ...(probe ? provider === "openai"
        ? { max_completion_tokens: 32 }
        : { max_tokens: 32 } : {}),
    },
  };
}

export async function testModelConnection(
  provider: ProviderId,
  model: string,
  apiKey: string
): Promise<void> {
  const request = modelRequest(provider, model, apiKey, "", "Reply with OK.", true);
  const payload = await requestJson(request.url, request.headers, request.body, 30_000);
  if (!isRecord(payload) || "error" in payload) throw new ModelRequestError("INVALID_RESPONSE", 502);
}

export async function generateWithModel(
  provider: ProviderId,
  model: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const request = modelRequest(provider, model, apiKey, systemPrompt, userPrompt, false);
  const payload = await requestJson(request.url, request.headers, request.body, 120_000);
  const text = responseText(provider, payload).trim();
  if (!text) throw new ModelRequestError("INVALID_RESPONSE", 502);
  return text;
}