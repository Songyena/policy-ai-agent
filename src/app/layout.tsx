import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "정책 싱크 · 영향도 분석 에이전트",
  description: "엑셀/피그마 정책 문서를 파싱하고 검수하여 지식창고에 적재하는 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
