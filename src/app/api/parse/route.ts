import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { env } from "@/config/env";
import { extractFigmaFileKey, fetchFigmaFileText, parseExcelFile } from "@/parser/index";
import { generateCandidates, saveCandidates } from "@/refine/index";
import type { RawPolicySource } from "@/types/policy";

/**
 * 1단계(parser) + 2단계(refine) 진입점.
 * 업로드된 엑셀 파일과 Figma URL을 받아 RawPolicySource로 파싱한 뒤,
 * AI로 정책 후보를 생성하고 검수 대기(staging) 상태로 저장한다.
 */
export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "요청 본문을 읽을 수 없습니다 (multipart/form-data 필요)." }, { status: 400 });
  }

  const file = formData.get("file");
  const figmaUrlRaw = formData.get("figmaUrl");
  const figmaUrl = typeof figmaUrlRaw === "string" ? figmaUrlRaw.trim() : "";

  const sources: RawPolicySource[] = [];

  if (file instanceof File && file.size > 0) {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ error: "엑셀(.xlsx) 파일만 업로드할 수 있습니다." }, { status: 400 });
    }

    mkdirSync(env.RAW_DATA_DIR, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    const savedPath = join(env.RAW_DATA_DIR, `${Date.now()}-${file.name}`);
    writeFileSync(savedPath, buffer);

    try {
      sources.push(...parseExcelFile(savedPath));
    } catch (error) {
      return NextResponse.json(
        { error: `엑셀 파일 파싱 실패: ${error instanceof Error ? error.message : String(error)}` },
        { status: 400 },
      );
    }
  }

  if (figmaUrl) {
    const fileKey = extractFigmaFileKey(figmaUrl);
    if (!fileKey) {
      return NextResponse.json({ error: "유효한 Figma 파일 URL이 아닙니다." }, { status: 400 });
    }

    try {
      sources.push(...(await fetchFigmaFileText(fileKey)));
    } catch (error) {
      return NextResponse.json(
        { error: `Figma 파일 조회 실패: ${error instanceof Error ? error.message : String(error)}` },
        { status: 400 },
      );
    }
  }

  if (sources.length === 0) {
    return NextResponse.json(
      { error: "엑셀 파일 또는 Figma URL 중 하나 이상을 입력해주세요." },
      { status: 400 },
    );
  }

  try {
    const candidates = await generateCandidates(sources);
    saveCandidates(candidates);
    return NextResponse.json({ candidates });
  } catch (error) {
    return NextResponse.json(
      { error: `정책 후보 생성 실패: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    );
  }
}
