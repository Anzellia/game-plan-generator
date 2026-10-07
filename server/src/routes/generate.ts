import { Router } from "express";
import { z } from "zod";
import {
  generateWithModel,
  isValidModelId,
  listProviderModels,
  ModelRequestError,
  testModelConnection,
} from "../lib/model-providers";

const ProviderKeyBody = z.object({
  provider: z.enum(["openai", "anthropic", "google", "xai", "deepseek"]),
  apiKey: z.string().trim().min(1).max(512),
});
const ModelIdBody = z.string().trim().min(1).max(200).refine(isValidModelId);
const TestModelBody = ProviderKeyBody.extend({ model: ModelIdBody });
const GenerateGamePlanBody = TestModelBody.extend({
  idea: z.string().trim().min(1).max(4000),
  language: z.enum(["zh", "ja", "en"]).optional(),
});

const GamePlanSchema = z.object({
  designDoc: z.object({
    title: z.string(),
    genre: z.string(),
    concept: z.string(),
    coreLoop: z.string(),
    targetAudience: z.string(),
    platforms: z.array(z.string()),
    features: z.array(z.string()).optional(),
  }),
  taskList: z.array(z.object({
    id: z.number(),
    category: z.string(),
    title: z.string(),
    description: z.string().nullable().optional(),
    priority: z.string(),
    estimatedHours: z.number(),
  })),
  technicalChallenges: z.array(z.object({
    title: z.string(),
    difficulty: z.string(),
    description: z.string(),
    solution: z.string(),
  })),
  weeklyPlan: z.array(z.object({
    day: z.number(),
    label: z.string(),
    tasks: z.array(z.string()),
    milestone: z.string(),
  })).length(7),
});

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  zh: "Generate ALL text content in Simplified Chinese (简体中文). This includes the title, genre, concept, coreLoop, targetAudience, features, task titles, task descriptions, challenge titles, challenge descriptions, solutions, day labels, task items, and milestones. Only keep technical terms (like programming language names) in English.",
  ja: "Generate ALL text content in Japanese (日本語). This includes the title, genre, concept, coreLoop, targetAudience, features, task titles, task descriptions, challenge titles, challenge descriptions, solutions, day labels, task items, and milestones. Only keep technical terms (like programming language names) in English.",
  en: "Generate ALL text content in English.",
};

export const generateRouter = Router();

generateRouter.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

generateRouter.post("/models", async (req, res) => {
  const parsed = ProviderKeyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID_REQUEST" });
    return;
  }
  try {
    const models = await listProviderModels(parsed.data.provider, parsed.data.apiKey);
    res.json({ models });
  } catch (error) {
    if (error instanceof ModelRequestError) {
      res.status(error.status).json({ error: error.code });
      return;
    }
    res.status(502).json({ error: "PROVIDER_UNAVAILABLE" });
  }
});

generateRouter.post("/models/test", async (req, res) => {
  const parsed = TestModelBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID_REQUEST" });
    return;
  }
  try {
    await testModelConnection(parsed.data.provider, parsed.data.model, parsed.data.apiKey);
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof ModelRequestError) {
      res.status(error.status).json({ error: error.code });
      return;
    }
    res.status(502).json({ error: "PROVIDER_UNAVAILABLE" });
  }
});

generateRouter.post("/generate", async (req, res) => {
  const parsed = GenerateGamePlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID_REQUEST" });
    return;
  }

  const { idea, language = "zh", provider, model, apiKey } = parsed.data;

  const langInstruction =
    LANGUAGE_INSTRUCTIONS[language] ?? LANGUAGE_INSTRUCTIONS.zh;

  try {
    const systemPrompt = `You are a professional game design AI assistant.

${langInstruction}

Given a game idea, generate a complete game plan as a JSON object with EXACTLY this structure (use camelCase for all keys):

{
  "designDoc": {
    "title": "string — game title",
    "genre": "string — genre",
    "concept": "string — one paragraph describing the game",
    "coreLoop": "string — core gameplay loop description",
    "targetAudience": "string — who is this game for",
    "platforms": ["string"],
    "features": ["string — key feature"]
  },
  "taskList": [
    {
      "id": number,
      "category": "string — one of: programming, design, art, audio, qa",
      "title": "string",
      "description": "string or null",
      "priority": "high | medium | low",
      "estimatedHours": number
    }
  ],
  "technicalChallenges": [
    {
      "title": "string",
      "difficulty": "hard | medium | easy",
      "description": "string — what the challenge is",
      "solution": "string — how to solve it"
    }
  ],
  "weeklyPlan": [
    {
      "day": number,
      "label": "string — e.g. Day 1 — Foundation",
      "tasks": ["string"],
      "milestone": "string — what is achieved by end of this day"
    }
  ]
}

Rules:
- Return ONLY the JSON object, no markdown, no explanation.
- weeklyPlan must have exactly 7 entries (day 1–7).
- taskList should have 6–10 tasks.
- technicalChallenges should have 3–5 entries.
- All keys must be camelCase exactly as shown above.
- priority values must be exactly: high, medium, or low (lowercase English).
- difficulty values must be exactly: hard, medium, or easy (lowercase English).
- category values must be exactly one of: programming, design, art, audio, qa (lowercase English).`;
    const text = await generateWithModel(
      provider, model, apiKey, systemPrompt, `Game idea: ${idea}`
    );
    const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const gamePlan = GamePlanSchema.safeParse(JSON.parse(jsonText));
    if (!gamePlan.success) {
      res.status(502).json({ error: "INVALID_RESPONSE" });
      return;
    }

    res.json(gamePlan.data);
  } catch (error) {
    if (error instanceof ModelRequestError) {
      res.status(error.status).json({ error: error.code });
      return;
    }
    // Malformed model output is not an application error. Never log the API key or payload.
    res.status(502).json({ error: "INVALID_RESPONSE" });
  }
});
