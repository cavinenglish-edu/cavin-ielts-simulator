import { NextResponse, connection } from "next/server";
import {
  computerParts,
  isRetiredSpeakingSet,
  mixAvailability,
  mixCandidatesFromPapers,
  toLibraryPaper,
  type LibraryPaper,
  type LibraryPayload,
  type PublishedRow,
} from "@/lib/exam-catalog";
import { FIXTURE_ACTUAL_ID, FIXTURE_FORECAST_ID } from "@/lib/exam-fixture";
import { supabase } from "@/lib/supabase";

function fixtureLibrary(): LibraryPayload {
  const papers: LibraryPaper[] = [
    {
      id: FIXTURE_ACTUAL_ID,
      title: "Actual Harbour Sitting",
      examinerName: "IELTS on Computer",
      catalog: "actual",
      skill: "listening",
      mode: "computer",
    },
    {
      id: FIXTURE_FORECAST_ID,
      title: "Forecast: Daily Routines",
      examinerName: "Ms. Emma Cole",
      catalog: "forecast",
      skill: "speaking",
      mode: "speaking",
    },
  ];
  return {
    papers,
    mix: mixAvailability(
      papers.map((paper) => ({
        id: paper.id,
        title: paper.title,
        catalog: paper.catalog,
        listening: paper.catalog === "actual",
        reading: false,
        writing: false,
      })),
    ),
  };
}

function emptyLibrary(): LibraryPayload {
  return {
    papers: [],
    mix: mixAvailability([]),
  };
}

export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  if (process.env.E2E_FIXTURE === "1") {
    if (url.searchParams.get("empty") === "1") return NextResponse.json(emptyLibrary());
    return NextResponse.json(fixtureLibrary());
  }

  if (!supabase) return NextResponse.json(emptyLibrary());

  const selected = await supabase
    .from("ielts_exams")
    .select("id, title, examiner_name, skill, paper")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  let rows = (selected.data ?? []) as PublishedRow[];
  if (selected.error) {
    const plain = await supabase
      .from("ielts_exams")
      .select("id, title, examiner_name, skill")
      .eq("status", "published")
      .order("created_at", { ascending: false });
    if (plain.error || !plain.data) return NextResponse.json(emptyLibrary());
    rows = plain.data as PublishedRow[];
  }

  const papers = rows
    .filter((row) => !isRetiredSpeakingSet(row.id, row.title))
    .map((row) => toLibraryPaper(row))
    .filter((paper): paper is LibraryPaper => paper !== null);

  const partsById = new Map(
    rows.map((row) => [String(row.id), computerParts(row.paper)] as const),
  );

  return NextResponse.json({
    papers,
    mix: mixAvailability(mixCandidatesFromPapers(papers, partsById)),
  });
}
