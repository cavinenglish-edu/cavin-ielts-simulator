import type { QuestionType } from "@/lib/exam-skill";

export type ClientQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: string[];
};

export type ClientListening = {
  title: string;
  durationSeconds: number;
  sections: Array<{
    id: string;
    title: string;
    audioUrl: string;
    questions: ClientQuestion[];
  }>;
};

export type ClientReading = {
  title: string;
  passages: Array<{ id: string; title: string; text: string; questions: ClientQuestion[] }>;
};

export type ClientWriting = {
  title: string;
  task1: { prompt: string; imageUrl?: string };
  task2: { prompt: string };
};
