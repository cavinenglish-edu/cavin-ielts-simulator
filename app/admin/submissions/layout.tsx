import { AdminChrome } from "@/app/admin/chrome";

export const metadata = {
  title: "Bài đã nộp | Cavin's English",
  robots: { index: false, follow: false },
};

export const instant = false;
export const maxDuration = 120;

export default function SubmissionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminChrome badge="Bài đã nộp" current="submissions">
      {children}
    </AdminChrome>
  );
}
