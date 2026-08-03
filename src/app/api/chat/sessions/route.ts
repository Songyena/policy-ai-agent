import { NextResponse } from "next/server";
import { getCurrentUser } from "@/auth/currentUser";
import { listSessionsForUser } from "@/db/chatSessionStore";

/** 로그인한 사용자의(만료되지 않은) 대화 세션 목록을 최신순으로 반환한다 — 메시지 본문은 뺀 요약본. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const items = listSessionsForUser(user.id).map((session) => ({
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  }));
  return NextResponse.json({ items });
}
