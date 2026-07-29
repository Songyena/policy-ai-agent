"use client";

import { useEffect, useState } from "react";
import { POLICY_FIELD_LABELS } from "@/types/policy";
import { TERM_FIELD_LABELS } from "@/types/term";
import { TERMS_CONDITIONS_FIELD_LABELS } from "@/types/termsConditions";
import type { EntityType } from "./types";

const ENTITY_LABEL: Record<EntityType, string> = {
  policy: "정책",
  term: "용어",
  termsConditions: "이용약관",
};

const ENTITY_ENDPOINT: Record<EntityType, string> = {
  policy: "/api/policies",
  term: "/api/terms",
  termsConditions: "/api/terms-conditions",
};

const FIELD_LABELS: Record<EntityType, Record<string, string>> = {
  policy: POLICY_FIELD_LABELS as Record<string, string>,
  term: TERM_FIELD_LABELS as Record<string, string>,
  termsConditions: TERMS_CONDITIONS_FIELD_LABELS as Record<string, string>,
};

interface RecordListModalProps {
  onClose: () => void;
}

export default function RecordListModal({ onClose }: RecordListModalProps) {
  const [activeTab, setActiveTab] = useState<EntityType>("policy");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(true);
      setError(null);
      const params = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
      fetch(`${ENTITY_ENDPOINT[activeTab]}${params}`)
        .then((res) => res.json())
        .then((data) => setItems(data.items ?? []))
        .catch((err) => setError(err instanceof Error ? err.message : String(err)))
        .finally(() => setIsLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [activeTab, query]);

  const labels = FIELD_LABELS[activeTab];
  const fieldKeys = Object.keys(labels).filter((key) => key !== "author" && key !== "updatedAt");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-card border border-border bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-ink">등록된 항목 목록</h2>
          <button type="button" onClick={onClose} className="text-subtle hover:text-ink">
            ✕
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-border px-5 pt-3">
          <div className="flex gap-1">
            {(["policy", "term", "termsConditions"] as EntityType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setActiveTab(type)}
                className={`rounded-t-control px-3 py-2 text-sm font-medium ${
                  activeTab === type
                    ? "border-x border-t border-border bg-surface text-primary"
                    : "text-subtle hover:text-ink"
                }`}
              >
                {ENTITY_LABEL[type]}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="검색어 입력"
            className="mb-2 w-48 rounded-control border border-border px-2.5 py-1.5 text-sm text-ink focus:border-primary focus:outline-none"
          />
        </div>

        <div className="flex-1 overflow-auto px-5 py-4">
          {error && <p className="mb-2 text-xs text-danger">{error}</p>}
          {isLoading ? (
            <p className="py-8 text-center text-sm text-subtle">불러오는 중...</p>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-subtle">등록된 항목이 없습니다.</p>
          ) : (
            <div className="overflow-auto rounded-control border border-border">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-page-bg">
                  <tr>
                    {fieldKeys.map((key) => (
                      <th
                        key={key}
                        className="whitespace-nowrap border-b border-border px-2 py-2 text-left text-xs font-medium uppercase tracking-wide text-subtle"
                      >
                        {labels[key]}
                      </th>
                    ))}
                    <th className="whitespace-nowrap border-b border-border px-2 py-2 text-left text-xs font-medium uppercase tracking-wide text-subtle">
                      개정
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={String(item.id)} className="border-b border-border-subtle">
                      {fieldKeys.map((key) => {
                        const value = item[key];
                        const display = Array.isArray(value) ? value.join(", ") : String(value ?? "");
                        return (
                          <td key={key} className="max-w-[280px] truncate px-2 py-1.5 text-ink" title={display}>
                            {display}
                          </td>
                        );
                      })}
                      <td className="px-2 py-1.5 text-xs text-subtle">v{String(item.revision ?? 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <span className="text-xs text-subtle">총 {items.length}건</span>
          <button type="button" onClick={onClose} className="rounded-control px-3 py-1.5 text-sm text-subtle hover:bg-page-bg">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
