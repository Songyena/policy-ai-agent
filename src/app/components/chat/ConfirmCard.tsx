"use client";

import { useState } from "react";
import { POLICY_FIELD_LABELS } from "@/types/policy";
import { TERM_FIELD_LABELS } from "@/types/term";
import { TERMS_CONDITIONS_FIELD_LABELS } from "@/types/termsConditions";
import type { CardStatus, ConfirmCardData } from "./types";

const ENTITY_LABEL: Record<ConfirmCardData["type"], string> = {
  policy: "정책",
  term: "용어",
  termsConditions: "이용약관",
};

const FIELD_LABELS: Record<ConfirmCardData["type"], Record<string, string>> = {
  policy: POLICY_FIELD_LABELS as Record<string, string>,
  term: TERM_FIELD_LABELS as Record<string, string>,
  termsConditions: TERMS_CONDITIONS_FIELD_LABELS as Record<string, string>,
};

// author/updatedAt은 확인 카드에서 입력받지 않는다 — 로그인 사용자/등록 시각으로 서버가 채운다.
const HIDDEN_FIELDS = new Set(["author", "updatedAt"]);

interface ConfirmCardProps {
  card: ConfirmCardData;
  status?: CardStatus;
  onConfirm: (fields: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

export default function ConfirmCard({ card, status, onConfirm, onCancel }: ConfirmCardProps) {
  const labels = FIELD_LABELS[card.type];
  const fieldKeys = Object.keys(labels).filter((key) => !HIDDEN_FIELDS.has(key));
  const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...card.fields }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDone = status === "confirmed" || status === "cancelled";

  function updateField(key: string, raw: string) {
    if (key === "synonyms") {
      setValues((prev) => ({
        ...prev,
        synonyms: raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      }));
      return;
    }
    setValues((prev) => ({ ...prev, [key]: raw }));
  }

  async function handleConfirm() {
    setError(null);
    setIsSubmitting(true);
    try {
      await onConfirm(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-card border border-border bg-surface p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <span className="inline-flex items-center rounded-pill bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          {ENTITY_LABEL[card.type]} 등록 확인
        </span>
        {status === "confirmed" && (
          <span className="inline-flex items-center rounded-pill bg-success-bg px-2.5 py-0.5 text-xs font-medium text-success">
            등록 완료
          </span>
        )}
        {status === "cancelled" && (
          <span className="inline-flex items-center rounded-pill bg-page-bg px-2.5 py-0.5 text-xs font-medium text-subtle">
            취소됨
          </span>
        )}
      </div>

      <div className="space-y-2.5">
        {fieldKeys.map((key) => {
          const value = values[key];
          const displayValue = Array.isArray(value) ? value.join(", ") : String(value ?? "");
          const isEnum = key === "useStatus" || key === "requiredStatus";
          const enumOptions = key === "useStatus" ? ["사용", "미사용"] : ["필수", "선택"];

          return (
            <label key={key} className="block">
              <span className="mb-1 block text-xs text-subtle">{labels[key]}</span>
              {isEnum ? (
                <select
                  value={displayValue}
                  disabled={isDone}
                  onChange={(e) => updateField(key, e.target.value)}
                  className="w-full rounded-control border border-border px-2.5 py-1.5 text-sm text-ink disabled:bg-page-bg"
                >
                  {enumOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={displayValue}
                  disabled={isDone}
                  onChange={(e) => updateField(key, e.target.value)}
                  className="w-full rounded-control border border-border px-2.5 py-1.5 text-sm text-ink disabled:bg-page-bg"
                />
              )}
            </label>
          );
        })}
      </div>

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      {!isDone && (
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-control px-3 py-1.5 text-sm text-subtle hover:bg-page-bg"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="rounded-control bg-primary px-3.5 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "등록 중..." : "등록"}
          </button>
        </div>
      )}
    </div>
  );
}
