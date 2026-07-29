import { NextResponse } from "next/server";
import { policyStore } from "@/db/index";

/** 등록된 정책 목록을 읽기 전용으로 조회한다(리스트 보기 모달용). */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const items = query ? policyStore.search(query) : policyStore.getAll();
  return NextResponse.json({ items });
}
