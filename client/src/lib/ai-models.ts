export const AI_PROVIDERS = [
  { id: "openai", name: "OpenAI" },
  { id: "anthropic", name: "Anthropic" },
  { id: "google", name: "Google" },
  { id: "xai", name: "xAI" },
  { id: "deepseek", name: "DeepSeek" },
] as const;

export type ProviderId = (typeof AI_PROVIDERS)[number]["id"];
export type AvailableModel = { id: string; name: string };

export function isProviderId(value: string): value is ProviderId {
  return AI_PROVIDERS.some((provider) => provider.id === value);
}