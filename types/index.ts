export interface CandidateInfo {
  name: string;
  id: string;
  number: string;
  target: string;
  selectedExamId?: string;
}

export interface ExamAnswer {
  questionId: string;
  questionText: string;
  part: number;
  transcript: string;
  durationSeconds: number;
}

export interface ExamSubmission {
  candidate: CandidateInfo;
  examTitle: string;
  season: string;
  examinerName: string;
  completedAt: string;
  answers: ExamAnswer[];
  scratchpad: string;
}

export interface FeedbackItem {
  id: number;
  part: number;
  question: string;
  originalTranscript: string;
  suggestedVocabulary: string[];
  improvedAnswer: string;
  grammarFixes: string;
}

export interface EvaluationResult {
  overall: number;
  criteria: {
    fc: { score: number; title: string; comments: string };
    lr: { score: number; title: string; comments: string };
    gra: { score: number; title: string; comments: string };
    p: { score: number; title: string; comments: string };
  };
  detailedFeedback: FeedbackItem[];
  timestamp: string;
}
