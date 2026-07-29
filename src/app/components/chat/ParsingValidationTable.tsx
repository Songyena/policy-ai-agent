"use client";

import { POLICY_FIELD_LABELS, POLICY_REQUIRED_FIELDS } from "@/types/policy";
import { TERM_FIELD_LABELS, TERM_REQUIRED_FIELDS } from "@/types/term";
import { TERMS_CONDITIONS_FIELD_LABELS, TERMS_CONDITIONS_REQUIRED_FIELDS } from "@/types/termsConditions";
import type { EntityType } from "./types";

export interface EditableRow {
  rowIndex: number;
  fields: Record<string, unknown>;
  errors: Record<string, string>;
}

const FIELD_LABELS: Record<EntityType, Record<string, string>> = {
  policy: POLICY_FIELD_LABELS as Record<string, string>,
  term: TERM_FIELD_LABELS as Record<string, string>,
  termsConditions: TERMS_CONDITIONS_FIELD_LABELS as Record<string, string>,
};

const REQUIRED_FIELDS: Record<EntityType, readonly string[]> = {
  policy: POLICY_REQUIRED_FIELDS,
  term: TERM_REQUIRED_FIELDS,
  termsConditions: TERMS_CONDITIONS_REQUIRED_FIELDS,
};

interface ParsingValidationTableProps {
  type: EntityType;
  rows: EditableRow[];
  onChangeCell: (rowIndex: number, field: string, rawValue: string) => void;
  onDeleteRow: (rowIndex: number) => void;
}

export default function ParsingValidationTable({ type, rows, onChangeCell, onDeleteRow }: ParsingValidationTableProps) {
  const labels = FIELD_LABELS[type];
  const fieldKeys = Object.keys(labels);
  const required = new Set<string>(REQUIRED_FIELDS[type]);

  return (
    <div className="max-h-[50vh] overflow-auto rounded-control border border-border">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-page-bg">
          <tr>
            <th className="border-b border-border px-2 py-2 text-left text-xs font-medium uppercase tracking-wide text-subtle">
              #
            </th>
            {fieldKeys.map((key) => (
              <th
                key={key}
                className="whitespace-nowrap border-b border-border px-2 py-2 text-left text-xs font-medium uppercase tracking-wide text-subtle"
              >
                {labels[key]}
                {required.has(key) && <span className="text-danger"> *</span>}
              </th>
            ))}
            <th className="border-b border-border px-2 py-2 text-left text-xs font-medium uppercase tracking-wide text-subtle">
              오류
            </th>
            <th className="border-b border-border px-2 py-2 text-left text-xs font-medium uppercase tracking-wide text-subtle" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const hasError = Object.keys(row.errors).length > 0;
            return (
              <tr key={row.rowIndex} className={hasError ? "bg-danger-bg/40" : "border-b border-border-subtle"}>
                <td className="px-2 py-1.5 text-xs text-subtle">{row.rowIndex}</td>
                {fieldKeys.map((key) => {
                  const value = row.fields[key];
                  const displayValue = Array.isArray(value) ? value.join(", ") : String(value ?? "");
                  const fieldError = row.errors[key];
                  return (
                    <td key={key} className="px-1.5 py-1">
                      <input
                        type="text"
                        value={displayValue}
                        onChange={(e) => onChangeCell(row.rowIndex, key, e.target.value)}
                        title={fieldError}
                        className={`w-full min-w-[110px] rounded-control border px-2 py-1 text-sm text-ink ${
                          fieldError ? "border-danger bg-danger-bg" : "border-border-subtle"
                        }`}
                      />
                    </td>
                  );
                })}
                <td className="px-2 py-1.5 text-xs text-danger">
                  {Object.values(row.errors).join(", ")}
                </td>
                <td className="px-2 py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => onDeleteRow(row.rowIndex)}
                    title="이 행 삭제"
                    className="rounded-control px-2 py-1 text-xs text-subtle hover:bg-danger-bg hover:text-danger"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
