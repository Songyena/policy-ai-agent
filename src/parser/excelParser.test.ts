import assert from "node:assert/strict";
import { test } from "node:test";
import * as XLSX from "xlsx";
import { parsePolicyWorkbook } from "./excelParser";

function buildWorkbookBuffer(): Buffer {
  const workbook = XLSX.utils.book_new();

  const policySheet = XLSX.utils.aoa_to_sheet([
    ["구분", "정책명", "세부항목", "설명1", "설명2", "예시", "작성자", "작성일"],
    ["채번규칙", "관리번호 채번규칙", "신용평가등급확인서", "CV+YYMMDD+4자리", "설명", "CV2411120001", "송예나", "2024-11-12"],
    ["결제정책", "환불정책", "", "", "", "", "", ""],
  ]);
  XLSX.utils.book_append_sheet(workbook, policySheet, "정책");

  const termSheet = XLSX.utils.aoa_to_sheet([
    ["용어1", "용어2", "메뉴", "개념", "비고"],
    ["관리번호", "고유번호", "마이페이지", "설명", "비고내용"],
    ["", "", "", "정의만 있음", ""],
  ]);
  XLSX.utils.book_append_sheet(workbook, termSheet, "용어");

  const termsConditionsSheet = XLSX.utils.aoa_to_sheet([
    ["사용여부", "필수여부", "기기구분", "약관명", "파일명", "관리코드", "제정일(개정일)"],
    ["사용", "필수", "공통", "이용약관", "terms.pdf", "1001", "2024-01-01"],
    ["Y", "", "공통", "잘못된 값 테스트", "", "1002", "2024-01-02"],
  ]);
  XLSX.utils.book_append_sheet(workbook, termsConditionsSheet, "이용약관");

  const memoSheet = XLSX.utils.aoa_to_sheet([["메모"], ["시트명이 인식 대상이 아님"]]);
  XLSX.utils.book_append_sheet(workbook, memoSheet, "기타메모");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

test("parsePolicyWorkbook detects sheet types by name and maps headers to fixed fields", () => {
  const result = parsePolicyWorkbook(buildWorkbookBuffer());

  assert.deepEqual(result.unrecognizedSheets, ["기타메모"]);
  assert.equal(result.sheets.length, 3);

  const policySheet = result.sheets.find((s) => s.type === "policy");
  assert.ok(policySheet);
  assert.equal(policySheet.rows.length, 2);
  assert.equal(policySheet.rows[0]?.fields.policyName, "관리번호 채번규칙");
  assert.equal(policySheet.rows[0]?.fields.example, "CV2411120001");
  assert.deepEqual(policySheet.rows[0]?.errors, {});
});

test("parsePolicyWorkbook flags missing required fields per entity type", () => {
  const result = parsePolicyWorkbook(buildWorkbookBuffer());

  const policySheet = result.sheets.find((s) => s.type === "policy")!;
  const invalidPolicyRow = policySheet.rows[1]!;
  assert.equal(invalidPolicyRow.errors.ruleDesc, "필수 항목입니다");
  assert.equal(invalidPolicyRow.errors.example, "필수 항목입니다");

  const termSheet = result.sheets.find((s) => s.type === "term")!;
  const invalidTermRow = termSheet.rows[1]!;
  assert.equal(invalidTermRow.errors.standardTerm, "필수 항목입니다");
  assert.equal(invalidTermRow.errors.uiMenu, "필수 항목입니다");
});

test("parsePolicyWorkbook validates enum-like fields for termsConditions", () => {
  const result = parsePolicyWorkbook(buildWorkbookBuffer());

  const termsConditionsSheet = result.sheets.find((s) => s.type === "termsConditions")!;
  const validRow = termsConditionsSheet.rows[0]!;
  assert.deepEqual(validRow.errors, {});

  const invalidRow = termsConditionsSheet.rows[1]!;
  assert.equal(invalidRow.errors.useStatus, "사용 또는 미사용 중 하나여야 합니다");
  assert.equal(invalidRow.errors.requiredStatus, "필수 항목입니다");
});
