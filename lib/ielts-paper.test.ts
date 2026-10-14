import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createAdminSessionToken,
  isRateLimited,
  passwordsMatch,
  recordFailure,
  verifyAdminSessionToken,
} from "./admin-session";
import { roomPathForSkill } from "./exam-skill";
import { answersMatch, countWords, scoreObjective } from "./ielts-score";
import { fieldErrorsFromZod, fromDbRow, paperInputSchema, preparePaperInput, toDbRow } from "./ielts-paper";

const listening = {
  skill: "listening",
  title: "Mini Listening",
  status: "published",
  sections: [
    {
      id: "s1",
      title: "Section 1",
      audioUrl: "https://cdn.example.com/section-1.mp3",
      questions: [
        { id: "q1", type: "short_text", prompt: "What is her name?", answer: "Anna" },
        { id: "blank", type: "short_text", prompt: "  ", answer: "  " },
      ],
    },
  ],
};

describe("paper schema", () => {
  it("accepts a one-question listening paper and drops blank rows", () => {
    const parsed = paperInputSchema.safeParse(preparePaperInput(listening));
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    assert.equal(parsed.data.skill, "listening");
    if (parsed.data.skill !== "listening") return;
    assert.equal(parsed.data.sections[0]?.questions.length, 1);
  });

  it("rejects listening without audio or questions", () => {
    const missingAudio = paperInputSchema.safeParse(
      preparePaperInput({
        ...listening,
        sections: [{ ...listening.sections[0], audioUrl: "" }],
      }),
    );
    assert.equal(missingAudio.success, false);

    const missingQuestions = paperInputSchema.safeParse(
      preparePaperInput({
        ...listening,
        sections: [{ ...listening.sections[0], questions: [] }],
      }),
    );
    assert.equal(missingQuestions.success, false);
    if (!missingQuestions.success) {
      const errors = fieldErrorsFromZod(missingQuestions.error);
      assert.ok(Object.keys(errors).length > 0);
    }
  });

  it("accepts a short academic reading paper", () => {
    const parsed = paperInputSchema.safeParse(
      preparePaperInput({
        skill: "reading",
        title: "Mini Reading",
        status: "published",
        passages: [
          {
            id: "p1",
            title: "Cities",
            text: "Many cities are growing quickly.",
            questions: [
              {
                id: "q1",
                type: "multiple_choice",
                prompt: "What is growing?",
                options: ["Cities", "Forests"],
                answer: "A",
              },
            ],
          },
        ],
      }),
    );
    assert.equal(parsed.success, true);
    if (!parsed.success || parsed.data.skill !== "reading") return;
    assert.equal(parsed.data.passages[0]?.questions[0]?.answer, "Cities");
  });

  it("rejects reading without passage text", () => {
    const parsed = paperInputSchema.safeParse(
      preparePaperInput({
        skill: "reading",
        title: "Mini Reading",
        status: "draft",
        passages: [
          {
            id: "p1",
            title: "Cities",
            text: " ",
            questions: [{ id: "q1", type: "short_text", prompt: "Where?", answer: "Hanoi" }],
          },
        ],
      }),
    );
    assert.equal(parsed.success, false);
  });

  it("accepts writing with both tasks and an optional image", () => {
    const parsed = paperInputSchema.safeParse(
      preparePaperInput({
        skill: "writing",
        title: "Mini Writing",
        status: "published",
        task1Prompt: "Summarise the chart.",
        task1ImageUrl: "",
        task2Prompt: "Some people prefer cities. Discuss.",
      }),
    );
    assert.equal(parsed.success, true);
  });

  it("rejects writing when task 2 is missing", () => {
    const parsed = paperInputSchema.safeParse(
      preparePaperInput({
        skill: "writing",
        title: "Mini Writing",
        status: "published",
        task1Prompt: "Summarise the chart.",
        task2Prompt: "",
      }),
    );
    assert.equal(parsed.success, false);
  });

  it("accepts a short speaking paper", () => {
    const parsed = paperInputSchema.safeParse(
      preparePaperInput({
        skill: "speaking",
        title: "Mini Speaking",
        status: "published",
        examinerName: "Ms. Sonia",
        examinerVoice: "en-GB-SoniaNeural",
        part1Questions: ["Where is your hometown?"],
        part2Prompt: "Describe a trip you took.",
        part2Bullets: ["Where you went"],
        part3Questions: ["Why do people travel?"],
      }),
    );
    assert.equal(parsed.success, true);
  });

  it("rejects speaking without part 1", () => {
    const parsed = paperInputSchema.safeParse(
      preparePaperInput({
        skill: "speaking",
        title: "Mini Speaking",
        status: "published",
        examinerName: "Ms. Sonia",
        examinerVoice: "en-GB-SoniaNeural",
        part1Questions: [" "],
        part2Prompt: "Describe a trip.",
        part2Bullets: ["Where"],
        part3Questions: ["Why?"],
      }),
    );
    assert.equal(parsed.success, false);
  });
});

describe("database shape", () => {
  it("keeps speaking on the columns the exam room already reads", () => {
    const parsed = paperInputSchema.parse(
      preparePaperInput({
        skill: "speaking",
        title: "Mini Speaking",
        status: "published",
        examinerName: "Mr. David Harrison",
        examinerVoice: "en-GB-RyanNeural",
        part1Questions: ["Where is your hometown?"],
        part2Prompt: "Describe a trip you took.",
        part2Bullets: ["Where you went"],
        part3Questions: ["Why do people travel?"],
      }),
    );
    const row = toDbRow(parsed);
    assert.equal(row.skill, "speaking");
    assert.deepEqual(row.paper, {});
    assert.deepEqual(row.part1_topics, [
      { id: "p1", title: "Part 1", questions: ["Where is your hometown?"] },
    ]);
    assert.deepEqual(row.part2_topic, {
      id: "p2",
      title: "Describe a trip you took.",
      content: "You should say:",
      bulletPoints: ["Where you went"],
    });
    assert.deepEqual(row.part3_questions, [{ id: "p3_q1", question: "Why do people travel?" }]);
    assert.equal(row.examiner_voice, "en-GB-RyanNeural");
    assert.equal(row.status, "published");
  });

  it("stores listening in paper and leaves speaking columns empty", () => {
    const parsed = paperInputSchema.parse(preparePaperInput(listening));
    const row = toDbRow(parsed);
    assert.equal(row.skill, "listening");
    assert.deepEqual(row.part1_topics, []);
    assert.deepEqual(row.part2_topic, {});
    assert.deepEqual(row.part3_questions, []);
    assert.equal(row.paper && "sections" in row.paper && row.paper.sections.length, 1);
  });

  it("reads a legacy speaking row that has no skill column", () => {
    const paper = fromDbRow({
      id: "6f1b4d3a-8c21-4e5b-9a10-0d4e8c2b7f11",
      title: "Bộ đề cũ",
      season: "Forecast Quý 3-4 / 2026",
      examiner_name: "Mr. David Harrison",
      examiner_role: "Senior Certified IELTS Examiner",
      examiner_avatar: "https://images.unsplash.com/photo-1",
      examiner_voice: "en-GB-Standard-B",
      status: "published",
      part1_topics: [{ id: "p1", title: "Part 1", questions: ["Where is your hometown?"] }],
      part2_topic: {
        id: "p2",
        title: "Describe a trip",
        content: "You should say:",
        bulletPoints: ["Where you went"],
      },
      part3_questions: [{ id: "p3_q1", question: "Why do people travel?" }],
    });
    assert.equal(paper.skill, "speaking");
    if (paper.skill !== "speaking") return;
    assert.equal(paper.examinerVoice, "en-GB-RyanNeural");
    assert.deepEqual(paper.part1Questions, ["Where is your hometown?"]);
    const row = toDbRow(paper);
    assert.equal(row.part2_topic && "content" in row.part2_topic && row.part2_topic.content, "You should say:");
    assert.equal(row.skill, "speaking");
  });
});

describe("scoring and routes", () => {
  it("scores a known listening key, including letter answers", () => {
    const questions = [
      { id: "q1", type: "short_text" as const, prompt: "Name?", answer: "Anna" },
      {
        id: "q2",
        type: "multiple_choice" as const,
        prompt: "Where?",
        options: ["Hanoi", "Hue"],
        answer: "Hue",
      },
      {
        id: "q3",
        type: "true_false_not_given" as const,
        prompt: "The city is old.",
        options: ["True", "False", "Not Given"],
        answer: "Not Given",
      },
    ];
    const result = scoreObjective(questions, { q1: " anna ", q2: "B", q3: "NG" });
    assert.equal(result.total, 3);
    assert.equal(result.correct, 3);
    assert.equal(answersMatch("Anna", "Minh"), false);
  });

  it("counts writing words", () => {
    assert.equal(countWords("  hello   world "), 2);
    assert.equal(countWords("   "), 0);
  });

  it("routes each skill to its room and leaves unknown ids on speaking", () => {
    assert.equal(roomPathForSkill("listening"), "/exam/listening");
    assert.equal(roomPathForSkill("reading"), "/exam/reading");
    assert.equal(roomPathForSkill("writing"), "/exam/writing");
    assert.equal(roomPathForSkill("speaking"), "/exam/room");
    assert.equal(roomPathForSkill(undefined), "/exam/room");
    assert.equal(roomPathForSkill("forecast"), "/exam/room");
  });
});

describe("admin session", () => {
  it("accepts a token only for the same secret before it expires", () => {
    const now = 1_700_000_000_000;
    const token = createAdminSessionToken("secret-value", now);
    assert.equal(verifyAdminSessionToken(token, "secret-value", now), true);
    assert.equal(verifyAdminSessionToken(token, "other-secret", now), false);
    assert.equal(verifyAdminSessionToken(token, "secret-value", now + 13 * 60 * 60 * 1000), false);
    assert.equal(verifyAdminSessionToken("not-a-token", "secret-value", now), false);
  });

  it("compares passwords without treating a different length as equal", () => {
    assert.equal(passwordsMatch("correct-horse", "correct-horse"), true);
    assert.equal(passwordsMatch("correct-horse", "correct-horses"), false);
    assert.equal(passwordsMatch("1234", "correct-horse"), false);
  });

  it("blocks the ninth failure inside the window", () => {
    const store = new Map<string, number[]>();
    for (let i = 0; i < 8; i += 1) recordFailure(store, "ip", 1_000 + i);
    assert.equal(isRateLimited(store, "ip", 2_000), true);
    assert.equal(isRateLimited(store, "other", 2_000), false);
  });
});
