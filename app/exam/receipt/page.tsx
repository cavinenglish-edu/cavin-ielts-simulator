import { Suspense } from "react";
import { ReceiptView } from "@/app/exam/components/receipt-view";
import { publicSession, requireSection } from "@/lib/sitting-cookie";

export const instant = false;

export default function ReceiptPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-100 px-6 py-10 text-sm text-slate-600">Đang mở biên nhận…</main>}>
      <ReceiptGate />
    </Suspense>
  );
}

async function ReceiptGate() {
  const session = await requireSection("done");
  return <ReceiptView session={publicSession(session)} />;
}
