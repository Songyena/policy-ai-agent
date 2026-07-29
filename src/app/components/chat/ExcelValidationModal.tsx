"use client";

import { useState } from "react";
import { POLICY_REQUIRED_FIELDS } from "@/types/policy";
import { TERM_REQUIRED_FIELDS } from "@/types/term";
import { TERMS_CONDITIONS_REQUIRED_FIELDS } from "@/types/termsConditions";
import ParsingValidationTable, { type EditableRow } from "./ParsingValidationTable";
import type { EntityType } from "./types";

const ENTITY_LABEL: Record<EntityType, string> = {
  policy: "정책",
  term: "용어",
  termsConditions: "이용약관",
};

const REQUIRED_FIELDS: Record<EntityType, readonly string[]> = {
  policy: POLICY_REQUIRED_FIELDS,
  term: TERM_REQUIRED_FIELDS,
  termsConditions: TERMS_CONDITIONS_REQUIRED_FIELDS,
};

const ENUM_FIELDS: Record<string, string[]> = {
  useStatus: ["사용", "미사용"],
  requiredStatus: ["필수", "선택"],
};

function validateFields(type: EntityType, fields: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const key of REQUIRED_FIELDS[type]) {
    const value = fields[key];
    const isEmpty = Array.isArray(value) ? value.length === 0 : !String(value ?? "").trim();
    if (isEmpty) errors[key] = "필수 항목입니다";
  }
  for (const [key, allowed] of Object.entries(ENUM_FIELDS)) {
    const value = fields[key];
    if (value && !allowed.includes(String(value))) {
      errors[key] = `${allowed.join(" 또는 ")} 중 하나여야 합니다`;
    }
  }
  return errors;
}

interface ParsedSheetInput {
  type: EntityType;
  sheetName: string;
  rows: { rowIndex: number; fields: Record<string, unknown>; errors: Record<string, string> }[];
}

export interface ExcelCommitSummary {
  committed: { policy: number; term: number; termsConditions: number };
  failed: { sheetName: string; rowIndex: number; errors: string[] }[];
}

interface ExcelValidationModalProps {
  sheets: ParsedSheetInput[];
  unrecognizedSheets: string[];
  onClose: () => void;
  onCommitted: (summary: ExcelCommitSummary) => void;
}

export default function ExcelValidationModal({
  sheets: initialSheets,
  unrecognizedSheets,
  onClose,
  onCommitted,
}: ExcelValidationModalProps) {
  const [sheets, setSheets] = useState(() =>
    initialSheets.map((sheet) => ({
      ...sheet,
      rows: sheet.rows.map((row): EditableRow => ({ ...row })),
    })),
  );
  const [activeTab, setActiveTab] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeSheet = sheets[activeTab];
  const totalRows = sheets.reduce((sum, s) => sum + s.rows.length, 0);
  const totalErrors = sheets.reduce(
    (sum, s) => sum + s.rows.filter((r) => Object.keys(r.errors).length > 0).length,
    0,
  );

  function handleChangeCell(rowIndex: number, field: string, rawValue: string) {
    setSheets((prev) =>
      prev.map((sheet, index) => {
        if (index !== activeTab) return sheet;
        return {
          ...sheet,
          rows: sheet.rows.map((row) => {
            if (row.rowIndex !== rowIndex) return row;
            const nextValue = field === "synonyms" ? rawValue.split(",").map((s) => s.trim()).filter(Boolean) : rawValue;
            const nextFields = { ...row.fields, [field]: nextValue };
            return { ...row, fields: nextFields, errors: validateFields(sheet.type, nextFields) };
          }),
        };
      }),
    );
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/excel/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheets: sheets.map((sheet) => ({
            type: sheet.type,
            sheetName: sheet.sheetName,
            rows: sheet.rows.map((row) => ({ rowIndex: row.rowIndex, fields: row.fields })),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "일괄 등록에 실패했습니다.");
      onCommitted(data as ExcelCommitSummary);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-card border border-border bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-ink">엑셀 파싱 검증</h2>
          <button type="button" onClick={onClose} className="text-subtle hover:text-ink">
            ✕
          </button>
        </div>

        {unrecognizedSheets.length > 0 && (
          <div className="border-b border-border-subtle bg-warning-bg px-5 py-2 text-xs text-warning">
            인식되지 않은 시트: {unrecognizedSheets.join(", ")} (시트명에 '정책'/'용어'/'약관'이 포함되어야 합니다)
          </div>
        )}

        {sheets.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-subtle">
            등록할 수 있는 시트를 찾지 못했습니다. 시트명이 '정책', '용어', '이용약관'을 포함하는지 확인해주세요.
          </div>
        ) : (
          <>
            <div className="flex gap-1 border-b border-border px-5 pt-3">
              {sheets.map((sheet, index) => (
                <button
                  key={`${sheet.sheetName}-${index}`}
                  type="button"
                  onClick={() => setActiveTab(index)}
                  className={`rounded-t-control px-3 py-2 text-sm font-medium ${
                    index === activeTab
                      ? "border-x border-t border-border bg-surface text-primary"
                      : "text-subtle hover:text-ink"
                  }`}
                >
                  {ENTITY_LABEL[sheet.type]}
                  <span className="ml-1 text-xs text-subtle">({sheet.sheetName})</span>
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-auto px-5 py-4">
              {activeSheet && (
                <ParsingValidationTable
                  type={activeSheet.type}
                  rows={activeSheet.rows}
                  onChangeCell={handleChangeCell}
                />
              )}
            </div>
          </>
        )}

        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <span className="text-xs text-subtle">
            총 {totalRows}행{totalErrors > 0 && <span className="text-danger"> (오류 {totalErrors}행)</span>}
          </span>
          <div className="flex items-center gap-3">
            {errorMessage && <span className="text-xs text-danger">{errorMessage}</span>}
            <button type="button" onClick={onClose} className="rounded-control px-3 py-1.5 text-sm text-subtle hover:bg-page-bg">
              취소
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || totalRows === 0}
              className="rounded-control bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "등록 중..." : "일괄 등록"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
