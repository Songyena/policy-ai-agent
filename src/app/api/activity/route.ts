import { NextResponse } from "next/server";
import { getActivityLog } from "@/db/index";

/** 정책/용어/이용약관 등록/개정/삭제 활동 로그를 읽기 전용으로 조회한다(변경 이력 탭용). */
export async function GET() {
  return NextResponse.json({ items: getActivityLog() });
}
