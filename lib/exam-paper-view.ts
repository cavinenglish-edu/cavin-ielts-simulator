import type { StandardQuestionType } from "@/lib/exam-skill";

export type ClientFormTable = {
  id: string;
  type: "form_table";
  title: string;
  rows: Array<{ id: string; label: string }>;
  note: string;
  gaps: Array<{ id: string; marker: number }>;
};

export type ClientQuestion =
  | {
      id: string;
      type: StandardQuestionType;
      prompt: string;
      options?: string[];
    }
  | ClientFormTable;

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
