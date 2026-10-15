import { gapsInNoteOrder, splitNote } from "@/lib/form-table";
import type { ClientFormTable } from "@/lib/exam-paper-view";

export function FormTableView({
  group,
  numbers,
  answers,
  onChange,
  disabled,
}: {
  group: ClientFormTable;
  numbers: number[];
  answers: Record<string, string>;
  onChange: (id: string, value: string) => void;
  disabled?: boolean;
}) {
  const gaps = gapsInNoteOrder(group.note, group.gaps);
  const rowNumbers = numbers.slice(0, group.rows.length);
  const gapNumbers = gaps.reduce((map, gap) => {
    if (!map.has(gap.marker)) map.set(gap.marker, numbers[group.rows.length + map.size] ?? 0);
    return map;
  }, new Map<number, number>());

  return (
    <section data-testid="form-group" className="border border-slate-400 bg-white">
      {group.rows.length > 0 ? (
        <table data-testid="form-table" className="w-full border-collapse text-sm">
          {group.title ? (
            <caption className="border border-slate-400 bg-slate-50 px-3 py-2 text-left text-sm font-bold text-slate-900">
              {group.title}
            </caption>
          ) : null}
          <tbody>
            {group.rows.map((row, index) => {
              const number = rowNumbers[index] ?? index + 1;
              return (
                <tr key={row.id} id={`question-${row.id}`}>
                  <th scope="row" className="w-1/2 border border-slate-400 px-3 py-2 text-left font-semibold text-slate-900">
                    {row.label}
                  </th>
                  <td className="border border-slate-400 px-3 py-2">
                    <label className="flex items-center gap-2">
                      <span className="inline-flex h-7 min-w-7 items-center justify-center bg-slate-900 px-1 text-xs font-bold text-white">
                        {number}
                      </span>
                      <input
                        aria-label={row.label}
                        data-testid={number === numbers[0] ? "form-blank" : undefined}
                        disabled={disabled}
                        value={answers[row.id] ?? ""}
                        onChange={(event) => onChange(row.id, event.target.value)}
                        className="w-full border border-slate-400 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : group.title ? (
        <h3 className="border-b border-slate-400 px-3 py-2 text-sm font-bold text-slate-900">{group.title}</h3>
      ) : null}
      {group.note ? (
        <p data-testid="form-note" className="px-3 py-3 text-sm leading-8 text-slate-900">
          {splitNote(group.note).map((part, index) => {
            if (part.kind === "text") return <span key={`t-${index}`}>{part.text}</span>;
            const gap = gaps.find((item) => item.marker === part.marker);
            const number = gapNumbers.get(part.marker);
            if (!gap || !number) return <span key={`g-${index}`}>{`{{${part.marker}}}`}</span>;
            return (
              <label key={`g-${index}`} id={`question-${gap.id}`} className="mx-1 inline-flex items-center gap-1 align-middle">
                <span className="inline-flex h-6 min-w-6 items-center justify-center bg-slate-900 px-1 text-xs font-bold text-white">
                  {number}
                </span>
                <input
                  aria-label={`Chỗ trống ${number}`}
                  disabled={disabled}
                  value={answers[gap.id] ?? ""}
                  onChange={(event) => onChange(gap.id, event.target.value)}
                  className="w-32 border-b border-slate-500 bg-transparent px-1 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
            );
          })}
        </p>
      ) : null}
    </section>
  );
}
