import { parseSkill, type Skill } from "@/lib/exam-skill";

export const PRACTICE_MIX_ID = "practice-mix";

export const RETIRED_SPEAKING_IDS = [
  "forecast-2026-travel",
  "forecast-2026-technology",
  "forecast-2026-environment",
  "forecast-2026-inspiring-people",
] as const;

const RETIRED_SPEAKING_TITLES = [
  "bộ đề 01: travel, journeys & unforeseen adventures",
  "bộ đề 02: artificial intelligence, technology & future careers",
  "bộ đề 03: environment, urban living & sustainability",
  "bộ đề 04: inspiring people, mentorship & culture",
];

export type CatalogKind = "actual" | "forecast";
export type LibraryMode = "computer" | "speaking" | "incomplete";

export type LibraryPaper = {
  id: string;
  title: string;
  examinerName: string;
  catalog: CatalogKind;
  skill: Skill;
  mode: LibraryMode;
};

export type MixAvailability = {
  ready: boolean;
  message: string;
};

export type LibraryPayload = {
  papers: LibraryPaper[];
  mix: MixAvailability;
};

const MIX_EMPTY =
  "Luyện trộn cần ít nhất ba đề thật đã xuất bản. Nghe, Đọc và Viết phải lấy từ ba đề khác nhau. Đây là bài luyện tập, không phải đề thi thật và không phải Forecast.";

export function normalizeCatalogText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isRetiredSpeakingSet(id?: string | null, title?: string | null): boolean {
  const normalizedId = normalizeCatalogText(id ?? "");
  if ((RETIRED_SPEAKING_IDS as readonly string[]).includes(normalizedId)) return true;
  const normalizedTitle = normalizeCatalogText(title ?? "");
  if (!normalizedTitle) return false;
  return RETIRED_SPEAKING_TITLES.some((retired) => {
    if (normalizedTitle === retired) return true;
    const topic = retired.split(":").slice(1).join(":").trim();
    return topic.length > 0 && (normalizedTitle === topic || normalizedTitle.endsWith(topic));
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function computerParts(paper: unknown): { listening: boolean; reading: boolean; writing: boolean } {
  const row = asRecord(paper);
  if (!row) return { listening: false, reading: false, writing: false };
  const listeningSource = Array.isArray(row.sections) ? row : asRecord(row.listening);
  const readingSource = Array.isArray(row.passages) ? row : asRecord(row.reading);
  const writingSource = asRecord(row.task1) ? row : asRecord(row.writing);
  const task1 = asRecord(writingSource?.task1);
  const task2 = asRecord(writingSource?.task2);
  return {
    listening: Array.isArray(listeningSource?.sections) && listeningSource.sections.length > 0,
    reading: Array.isArray(readingSource?.passages) && readingSource.passages.length > 0,
    writing: typeof task1?.prompt === "string" && task1.prompt.trim().length > 0 && typeof task2?.prompt === "string" && task2.prompt.trim().length > 0,
  };
}

export function readCatalog(paper: unknown, skill: Skill): CatalogKind {
  const declared = asRecord(paper)?.catalog;
  if (declared === "forecast" || declared === "actual") return declared;
  return skill === "speaking" ? "forecast" : "actual";
}

export function libraryMode(parts: { listening: boolean; reading: boolean; writing: boolean }, speaking: boolean): LibraryMode {
  if (parts.listening && parts.reading && parts.writing) return "computer";
  if (speaking) return "speaking";
  return "incomplete";
}

export type PublishedRow = {
  id: string;
  title?: string | null;
  examiner_name?: string | null;
  skill?: string | null;
  paper?: unknown;
};

export function toLibraryPaper(row: PublishedRow): LibraryPaper | null {
  const id = String(row.id ?? "").trim();
  const title = String(row.title ?? "").trim() || "Đề thi";
  if (!id || isRetiredSpeakingSet(id, title)) return null;
  const skill = parseSkill(row.skill);
  const parts = computerParts(row.paper);
  const catalog = readCatalog(row.paper, skill);
  const speaking = skill === "speaking" || Boolean(asRecord(row.paper)?.speaking);
  return {
    id,
    title,
    examinerName: String(row.examiner_name ?? "").trim() || (speaking ? "Giám khảo" : "IELTS on Computer"),
    catalog,
    skill,
    mode: libraryMode(parts, speaking),
  };
}

export type MixCandidate = {
  id: string;
  title?: string | null;
  catalog: CatalogKind;
  listening: boolean;
  reading: boolean;
  writing: boolean;
};

export function chooseMixIds(rows: MixCandidate[]): { listeningId: string; readingId: string; writingId: string } | null {
  const actuals = rows.filter((row) => row.catalog === "actual" && !isRetiredSpeakingSet(row.id, row.title));
  for (const listening of actuals) {
    if (!listening.listening) continue;
    for (const reading of actuals) {
      if (!reading.reading || reading.id === listening.id) continue;
      for (const writing of actuals) {
        if (!writing.writing || writing.id === listening.id || writing.id === reading.id) continue;
        return { listeningId: listening.id, readingId: reading.id, writingId: writing.id };
      }
    }
  }
  return null;
}

export function mixAvailability(rows: MixCandidate[]): MixAvailability {
  if (chooseMixIds(rows)) {
    return {
      ready: true,
      message: "Luyện trộn ghép Nghe, Đọc và Viết từ ba đề thật khác nhau. Đây là bài luyện tập, không phải đề thi thật và không phải Forecast.",
    };
  }
  return { ready: false, message: MIX_EMPTY };
}

export function mixCandidatesFromPapers(papers: LibraryPaper[], partsById: Map<string, { listening: boolean; reading: boolean; writing: boolean }>): MixCandidate[] {
  return papers.map((paper) => {
    const parts = partsById.get(paper.id) ?? { listening: false, reading: false, writing: false };
    return { id: paper.id, title: paper.title, catalog: paper.catalog, ...parts };
  });
}
