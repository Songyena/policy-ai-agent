import { NextResponse } from "next/server";
import { getCurrentUser } from "@/auth/currentUser";
import { findSession } from "@/db/chatSessionStore";

/** 대화 세션 한 건을(메시지 포함) 조회한다. 본인 세션이 아니면 접근할 수 없다. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await context.params;
  const session = findSession(id);
  if (!session || session.userId !== user.id) {
    return NextResponse.json({ error: "해당 대화를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ session });
}
