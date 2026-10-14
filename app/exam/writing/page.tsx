import { Suspense } from "react";
import { RoomStatus } from "@/app/exam/components/exam-shell";
import { WritingRoom } from "@/app/exam/components/writing-room";
import { clientWriting, loadFullPaper } from "@/lib/full-paper";
import { publicSession, requireSection } from "@/lib/sitting-cookie";

export const instant = false;

export default function WritingPage() {
  return (
    <Suspense fallback={<RoomStatus title="Writing" body="Đang mở phòng thi…" />}>
      <WritingGate />
    </Suspense>
  );
}

async function WritingGate() {
  const session = await requireSection("writing");
  const paper = await loadFullPaper(session.paperId);
  if (!paper) return <RoomStatus title="Writing" body="Không tải được đề của phiên thi này." />;
  return <WritingRoom initial={publicSession(session)} paper={clientWriting(paper)} />;
}
