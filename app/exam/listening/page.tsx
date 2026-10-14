import { Suspense } from "react";
import { RoomStatus } from "@/app/exam/components/exam-shell";
import { ListeningRoom } from "@/app/exam/components/listening-room";
import { clientListening, loadFullPaper } from "@/lib/full-paper";
import { publicSession, requireSection } from "@/lib/sitting-cookie";

export const instant = false;

export default function ListeningPage() {
  return (
    <Suspense fallback={<RoomStatus title="Listening" body="Đang mở phòng thi…" />}>
      <ListeningGate />
    </Suspense>
  );
}

async function ListeningGate() {
  const session = await requireSection("listening");
  const paper = await loadFullPaper(session.paperId);
  if (!paper) return <RoomStatus title="Listening" body="Không tải được đề của phiên thi này." />;
  return <ListeningRoom initial={publicSession(session)} paper={clientListening(paper)} />;
}
