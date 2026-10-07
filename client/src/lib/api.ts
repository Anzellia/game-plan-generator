import { useMutation } from "@tanstack/react-query";
import type { AvailableModel, ProviderId } from "./ai-models";
import type { GamePlan, GameIdeaInput } from "./types";

export class GenerateError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "GenerateError";
  }
}

async function postJson<T>(path: string, input: object): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new GenerateError(
      typeof payload?.error === "string" ? payload.error : "GENERATION_FAILED"
    );
  }

  return response.json() as Promise<T>;
}

export function fetchAvailableModels(provider: ProviderId, apiKey: string) {
  return postJson<{ models: AvailableModel[] }>("/api/models", { provider, apiKey });
}

export function testModelConnection(provider: ProviderId, model: string, apiKey: string) {
  return postJson<{ ok: boolean }>("/api/models/test", { provider, model, apiKey });
}

export async function generateGamePlan(input: GameIdeaInput): Promise<GamePlan> {
  return postJson<GamePlan>("/api/generate", input);
}

export function useGenerateGamePlan() {
  return useMutation({
    mutationFn: (input: GameIdeaInput) => generateGamePlan(input),
  });
}
