import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import * as XLSX from "xlsx";
import type { RawPolicySource } from "../types/policy";

export interface ExcelParseOptions {
  /**
   * 시트 이름 또는 파일명(확장자 제외)을 정책 카테고리로 매핑한다.
   * 예: { "배송정책": "배송", "환불정책": "환불" }
   * 매칭되는 항목이 없으면 categoryHint 없이 파싱한다 (최종 category는 refine 단계 AI가 정한다).
   */
  categoryMap?: Record<string, string>;
}

/**
 * 엑셀(.xlsx) 정책 문서의 **첫 번째 시트**를 읽어 행(Row) 단위로 RawPolicySource를 만든다.
 * 판단/정제는 하지 않고, 시트/파일명을 categoryMap에 매핑한 힌트만 함께 실어 refine 단계로 넘긴다.
 */
export function parseExcelFile(
  filePath: string,
  options: ExcelParseOptions = {},
): RawPolicySource[] {
  // XLSX.readFile()은 순수 ESM 환경에서 Node의 fs를 제대로 감지하지 못해
  // "Cannot access file" 오류를 던지는 알려진 문제가 있다. 파일을 직접 읽어
  // 버퍼를 넘기는 방식으로 우회한다.
  const buffer = readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error(`엑셀 파일에서 시트를 찾을 수 없습니다: ${filePath}`);
  }
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) {
    throw new Error(`시트 데이터를 읽을 수 없습니다: ${filePath} (${firstSheetName})`);
  }

  // 첫 행을 헤더로 사용해 각 행을 { 헤더: 값 } 형태의 JSON 객체로 변환한다.
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    blankrows: false,
  });

  const fileName = basename(filePath);
  const fileStem = fileName.replace(/\.[^/.]+$/, "");
  const categoryHint = options.categoryMap?.[firstSheetName] ?? options.categoryMap?.[fileStem];

  const extractedAt = new Date().toISOString();

  return rows.map((row, index) => ({
    id: randomUUID(),
    sourceType: "excel" as const,
    sourceRef: `${fileName}#${firstSheetName}!row${index + 2}`, // 헤더가 1행이므로 데이터는 2행부터
    rawText: Object.entries(row)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n"),
    categoryHint,
    extractedAt,
  }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const target = process.argv[2];
  if (!target) {
    console.error("사용법: npm run parse:excel -- <xlsx 파일 경로>");
    process.exit(1);
  }
  const sources = parseExcelFile(target);
  console.log(JSON.stringify(sources, null, 2));
}
