import type { ProviderId } from "./ai-models";

export interface DesignDoc {
  title: string;
  genre: string;
  concept: string;
  coreLoop: string;
  targetAudience: string;
  platforms: string[];
  features?: string[];
}

export interface Task {
  id: number;
  category: string;
  title: string;
  description?: string | null;
  priority: string;
  estimatedHours: number;
}

export interface TechnicalChallenge {
  title: string;
  difficulty: string;
  description: string;
  solution: string;
}

export interface DayPlan {
  day: number;
  label: string;
  tasks: string[];
  milestone: string;
}

export interface GamePlan {
  designDoc: DesignDoc;
  taskList: Task[];
  technicalChallenges: TechnicalChallenge[];
  weeklyPlan: DayPlan[];
}

export interface GameIdeaInput {
  idea: string;
  language?: "zh" | "ja" | "en";
  provider: ProviderId;
  model: string;
  apiKey: string;
}
