import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/auth/currentUser";
import { env } from "@/config/env";
import { parsePolicyWorkbook } from "@/parser/index";

/**
 * 엑셀 업로드 1단계: 파일을 받아 '정책'/'용어'/'이용약관' 시트를 자동 인식하고
 * 고정 스키마로 매핑 + 검증한 결과를 그대로 돌려준다. 여기서는 아무것도 저장(commit)하지 않는다 —
 * 프론트엔드의 파싱 검증 모달에서 사용자가 확인/수정한 뒤 /api/excel/commit을 호출해야 저장된다.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "요청 본문을 읽을 수 없습니다 (multipart/form-data 필요)." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "엑셀(.xlsx) 파일을 업로드해주세요." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ error: "엑셀(.xlsx) 파일만 업로드할 수 있습니다." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  mkdirSync(env.RAW_DATA_DIR, { recursive: true });
  writeFileSync(join(env.RAW_DATA_DIR, `${Date.now()}-${file.name}`), buffer);

  try {
    const parsed = parsePolicyWorkbook(buffer);
    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json(
      { error: `엑셀 파싱 실패: ${error instanceof Error ? error.message : String(error)}` },
      { status: 400 },
    );
  }
}
