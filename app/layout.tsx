import type { Metadata } from "next";
import "./globals.css";

import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "Cavin English - IELTS Speaking Simulator 1:1",
  description: "Hệ thống thi thử IELTS Speaking 1:1 mô phỏng áp lực phòng thi thực tế với Giám khảo AI bản xứ. Đếm giờ phản xạ và chấm điểm 4 tiêu chí chuẩn khảo thí BC/IDP.",
  openGraph: {
    title: "Cavin English - IELTS Speaking Simulator 1:1",
    description: "Hệ thống thi thử IELTS Speaking 1:1 mô phỏng áp lực phòng thi thực tế với Giám khảo AI bản xứ.",
    url: "https://cavinenglish2edu.com",
    siteName: "Cavin English",
    images: [
      {
        url: "https://cavinenglish2edu.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "Cavin English IELTS Simulator",
      },
    ],
    locale: "vi_VN",
    type: "website",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-white text-slate-900 antialiased flex flex-col">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
