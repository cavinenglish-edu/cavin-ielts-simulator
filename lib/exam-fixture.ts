import type { ExamDataSet } from "@/data/exam_data";
import { FIXTURE_PAPER_ID, listeningSecondsOrDefault } from "@/lib/exam-sitting";
import type { ListeningPaper, ReadingPaper, WritingPaper } from "@/lib/exam-skill";

export const FIXTURE_ACTUAL_ID = "fixture-actual";
export const FIXTURE_FORECAST_ID = "fixture-forecast";

export type FullPaper = {
  id: string;
  title: string;
  listeningSeconds: number;
  listening: ListeningPaper;
  reading: ReadingPaper;
  writing: WritingPaper;
};

export function fixtureFullPaper(): FullPaper {
  return {
    id: FIXTURE_PAPER_ID,
    title: "E2E Full Sitting",
    listeningSeconds: listeningSecondsOrDefault(30 * 60),
    listening: {
      durationSeconds: 30 * 60,
      sections: [
        {
          id: "s1",
          title: "Section 1",
          audioUrl: "/sound-check.wav",
          questions: [
            { id: "l1", type: "short_text", prompt: "What is her name?", answer: "Anna" },
            { id: "l2", type: "short_text", prompt: "Which city?", answer: "Hue" },
            {
              id: "lform",
              type: "form_table",
              title: "Buying a Used Car",
              rows: [
                { id: "lmodel", label: "Model", answer: "Corolla" },
                { id: "lyear", label: "Year", answer: "2012" },
                { id: "lcond", label: "Condition", answer: "good|fair" },
              ],
              note: "The seller lives in {{1}}.",
              gaps: [{ id: "lgap1", marker: 1, answer: "Hue" }],
            },
          ],
        },
      ],
    },
    reading: {
      passages: [
        {
          id: "p1",
          title: "The Harbour",
          text: [
            "The old harbour sits on the north side of the city, where fishing boats still leave before dawn.",
            "For most of the twentieth century the warehouses stored rice, timber, and salt.",
            "A new footbridge now links the quay to the market, but the morning bell still marks the first tide.",
            "Students who highlight a sentence can keep a note beside it and return after a reload.",
            "The passage is long enough to scroll on its own while the questions stay in the other column.",
            "Nothing in this fixture invents a band score. The clock is the only thing that ends the section.",
          ].join("\n\n"),
          questions: [
            {
              id: "r1",
              type: "short_text",
              prompt: "On which side of the city is the harbour?",
              answer: "north",
            },
          ],
        },
      ],
    },
    writing: {
      task1: {
        prompt: "The chart shows how many boats used the harbour in the morning and the evening. Summarise the information.",
      },
      task2: {
        prompt: "Some people think cities should close old harbours and build housing. Discuss both views and give your opinion.",
      },
    },
  };
}

export function fixtureSpeaking(kind: "actual" | "forecast"): ExamDataSet {
  if (kind === "forecast") {
    return {
      id: FIXTURE_FORECAST_ID,
      title: "Forecast: Daily Routines",
      category: "Forecast",
      season: "Forecast",
      examinerName: "Ms. Emma Cole",
      examinerRole: "Senior Certified IELTS Examiner",
      examinerVoice: "en-GB",
      part1: {
        welcome: "Good afternoon. Let's talk about your daily routine.",
        questions: [
          { id: "f1", question: "What time do you usually get up?", recommendedDurationSeconds: 30 },
        ],
      },
      part2: {
        id: "f2",
        topicTitle: "Describe a habit you want to change.",
        taskCardPrompt: "You should say:",
        bulletPoints: ["What the habit is", "Why you want to change it"],
        prepTimeSeconds: 60,
        speakTimeSeconds: 120,
      },
      part3: {
        topicIntro: "Let's talk more about routines.",
        questions: [{ id: "f3", question: "Why are routines useful?", recommendedDurationSeconds: 45 }],
      },
    };
  }
  return {
    id: FIXTURE_ACTUAL_ID,
    title: "Actual Harbour Sitting",
    category: "Actual",
    season: "Actual",
    examinerName: "Mr. Thomas Hale",
    examinerRole: "Senior Certified IELTS Examiner",
    examinerVoice: "en-GB",
    part1: {
      welcome: "Good afternoon. This is the speaking section of the same paper.",
      questions: [
        { id: "a1", question: "Do you live near the water?", recommendedDurationSeconds: 30 },
      ],
    },
    part2: {
      id: "a2",
      topicTitle: "Describe a harbour or river you know.",
      taskCardPrompt: "You should say:",
      bulletPoints: ["Where it is", "What people do there"],
      prepTimeSeconds: 60,
      speakTimeSeconds: 120,
    },
    part3: {
      topicIntro: "Let's talk about cities and water.",
      questions: [{ id: "a3", question: "Should cities keep their old harbours?", recommendedDurationSeconds: 45 }],
    },
  };
}
