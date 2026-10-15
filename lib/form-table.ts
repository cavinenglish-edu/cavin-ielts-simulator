const GAP_PATTERN = /\{\{\s*(\d+)\s*\}\}/g;

export type NotePart = { kind: "text"; text: string } | { kind: "gap"; marker: number };

export type BlankSource = {
  id: string;
  type: string;
  rows?: ReadonlyArray<{ id: string }>;
  note?: string;
  gaps?: ReadonlyArray<{ id: string; marker: number }>;
};

export function parseNoteGaps(note: string): number[] {
  const markers: number[] = [];
  const seen = new Set<number>();
  for (const match of note.matchAll(GAP_PATTERN)) {
    const marker = Number(match[1]);
    if (!Number.isInteger(marker) || marker < 1 || marker > 99 || seen.has(marker)) continue;
    seen.add(marker);
    markers.push(marker);
  }
  return markers;
}

export function splitNote(note: string): NotePart[] {
  const parts: NotePart[] = [];
  let last = 0;
  for (const match of note.matchAll(GAP_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ kind: "text", text: note.slice(last, index) });
    const marker = Number(match[1]);
    if (Number.isInteger(marker) && marker >= 1 && marker <= 99) parts.push({ kind: "gap", marker });
    else parts.push({ kind: "text", text: match[0] });
    last = index + match[0].length;
  }
  if (last < note.length) parts.push({ kind: "text", text: note.slice(last) });
  return parts;
}

export function gapsInNoteOrder<T extends { id: string; marker: number }>(note: string, gaps: ReadonlyArray<T>): T[] {
  const ordered: T[] = [];
  for (const marker of parseNoteGaps(note)) {
    const gap = gaps.find((item) => item.marker === marker);
    if (gap) ordered.push(gap);
  }
  return ordered;
}

export function examBlanks(questions: ReadonlyArray<BlankSource>): Array<{ id: string }> {
  const blanks: Array<{ id: string }> = [];
  for (const question of questions) {
    if (question.type !== "form_table") {
      blanks.push({ id: question.id });
      continue;
    }
    for (const row of question.rows ?? []) blanks.push({ id: row.id });
    for (const gap of gapsInNoteOrder(question.note ?? "", question.gaps ?? [])) blanks.push({ id: gap.id });
  }
  return blanks;
}

export function examBlankCount(questions: ReadonlyArray<BlankSource>): number {
  return examBlanks(questions).length;
}
