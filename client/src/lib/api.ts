import { useMutation } from "@tanstack/react-query";
import type { GamePlan, GameIdeaInput } from "./types";

export class GenerateError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "GenerateError";
  }
}

export async function generateGamePlan(input: GameIdeaInput): Promise<GamePlan> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new GenerateError(
      typeof payload?.error === "string" ? payload.error : "GENERATION_FAILED"
    );
  }

  return response.json();
}

export function useGenerateGamePlan() {
  return useMutation({
    mutationFn: (input: GameIdeaInput) => generateGamePlan(input),
  });
}
