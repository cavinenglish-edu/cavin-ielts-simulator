import { Suspense } from "react";
import { RoomStatus } from "@/app/exam/components/exam-shell";
import { ReadingRoom } from "@/app/exam/components/reading-room";
import { clientReading, loadFullPaper } from "@/lib/full-paper";
import { publicSession, requireSection } from "@/lib/sitting-cookie";

export const instant = false;

export default function ReadingPage() {
  return (
    <Suspense fallback={<RoomStatus title="Reading" body="Đang mở phòng thi…" />}>
      <ReadingGate />
    </Suspense>
  );
}

async function ReadingGate() {
  const session = await requireSection("reading");
  const paper = await loadFullPaper(session.paperId);
  if (!paper) return <RoomStatus title="Reading" body="Không tải được đề của phiên thi này." />;
  return <ReadingRoom initial={publicSession(session)} paper={clientReading(paper)} />;
}
