export const AI_PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    models: [
      { id: "gpt-5.6-sol", name: "GPT-5.6 Sol" },
      { id: "gpt-5.6", name: "GPT-5.6 Sol" },
      { id: "gpt-5.6-terra", name: "GPT-5.6 Terra" },
      { id: "gpt-5.6-luna", name: "GPT-5.6 Luna" },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    models: [
      { id: "claude-fable-5-1", name: "Claude Fable 5.1" },
      { id: "claude-opus-5-5", name: "Claude Opus 5.5" },
      { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5" },
      { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
    ],
  },
  {
    id: "google",
    name: "Google",
    models: [
      { id: "gemini-3.1-pro", name: "Gemini 3.1 Pro" },
      { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash" },
      { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash-Lite" },
    ],
  },
  {
    id: "xai",
    name: "xAI",
    models: [
      { id: "grok-4.7", name: "Grok 4.7" },
      { id: "grok-4.6", name: "Grok 4.6" },
      { id: "grok-4.5", name: "Grok 4.5" },
      { id: "grok-4.20-0309-reasoning", name: "Grok 4.20 reasoning" },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    models: [
      { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" },
      { id: "deepseek-flash", name: "DeepSeek V4.1 Flash" },
    ],
  },
] as const;

export type ProviderId = (typeof AI_PROVIDERS)[number]["id"];

export function isProviderId(value: string): value is ProviderId {
  return AI_PROVIDERS.some((provider) => provider.id === value);
}

export function modelsFor(providerId: ProviderId) {
  return AI_PROVIDERS.find((provider) => provider.id === providerId)!.models;
}