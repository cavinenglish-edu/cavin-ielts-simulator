import { FIXTURE_PAPER_ID, listeningSecondsOrDefault } from "@/lib/exam-sitting";
import type { ListeningPaper, ReadingPaper, WritingPaper } from "@/lib/exam-skill";

export const FIXTURE_ACCESS_CODE = "482913";

export type FullPaper = {
  id: string;
  title: string;
  accessCode: string;
  listeningSeconds: number;
  listening: ListeningPaper;
  reading: ReadingPaper;
  writing: WritingPaper;
};

export function fixtureFullPaper(): FullPaper {
  return {
    id: FIXTURE_PAPER_ID,
    title: "E2E Full Sitting",
    accessCode: FIXTURE_ACCESS_CODE,
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
