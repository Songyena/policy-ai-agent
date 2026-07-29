import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "크레디뷰 정책 Agent",
  description: "단일 대화창에서 정책/용어/이용약관을 조회·등록·엑셀 일괄 검증하는 AI 에이전트",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={inter.variable}>
      <body className="min-h-screen bg-page-bg text-ink antialiased">{children}</body>
    </html>
  );
}
