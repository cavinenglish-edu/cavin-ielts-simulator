export interface QuestionItem {
  id: string;
  question: string;
  followUpHint?: string;
  recommendedDurationSeconds: number;
}

export interface Part2Topic {
  id: string;
  topicTitle: string;
  taskCardPrompt: string;
  bulletPoints: string[];
  prepTimeSeconds: number;
  speakTimeSeconds: number;
  imageUrl?: string;
}

export interface ExamDataSet {
  id: string;
  title: string;
  category: string;
  season: string;
  examinerName: string;
  examinerRole: string;
  examinerVoice: "en-GB" | "en-US" | "en-AU";
  part1: {
    welcome: string;
    questions: QuestionItem[];
  };
  part2: Part2Topic;
  part3: {
    topicIntro: string;
    questions: QuestionItem[];
  };
}

/** Published papers come from Supabase. This list no longer ships the retired Speaking sets. */
export const EXAM_DATA_SETS: ExamDataSet[] = [];

export function getExamDataSetById(id: string): ExamDataSet | undefined {
  return EXAM_DATA_SETS.find((item) => item.id === id);
}
