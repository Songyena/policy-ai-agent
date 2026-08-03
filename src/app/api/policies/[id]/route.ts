import { NextResponse } from "next/server";
import { getCurrentUser } from "@/auth/currentUser";
import { deletePolicy } from "@/db/index";

/** 정책 한 건을 삭제한다. */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const removed = deletePolicy(id, user.name);
    if (!removed) {
      return NextResponse.json({ error: "해당 정책을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ record: removed });
  } catch (error) {
    return NextResponse.json(
      { error: `삭제 실패: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    );
  }
}
