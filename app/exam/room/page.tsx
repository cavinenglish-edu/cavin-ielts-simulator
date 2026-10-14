import { Suspense } from "react";
import SpeakingRoom from "./speaking-room";

async function RoomGate({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.preview) ? params.preview[0] : params.preview;
  const preview = process.env.E2E_FIXTURE === "1" && (raw === "prep" || raw === "record") ? raw : null;
  return <SpeakingRoom preview={preview} />;
}

export default function ExamRoomPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-100" />}>
      <RoomGate searchParams={searchParams} />
    </Suspense>
  );
}
