"use client";

import { useEffect, useMemo, useState } from "react";
import { POLICY_FIELD_LABELS } from "@/types/policy";
import { TERM_FIELD_LABELS } from "@/types/term";
import { TERMS_CONDITIONS_FIELD_LABELS } from "@/types/termsConditions";
import type { EntityType } from "../chat/types";

type ViewTab = EntityType | "activity";

const ENTITY_LABEL: Record<EntityType, string> = {
  policy: "정책",
  term: "용어",
  termsConditions: "이용약관",
};

const TAB_LABEL: Record<ViewTab, string> = {
  ...ENTITY_LABEL,
  activity: "변경 이력",
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

const TABS: ViewTab[] = ["policy", "term", "termsConditions", "activity"];

const ACTION_LABEL: Record<string, string> = { created: "등록", revised: "수정", deleted: "삭제" };
const ACTION_BADGE: Record<string, string> = {
  created: "bg-success-bg text-success",
  revised: "bg-warning-bg text-warning",
  deleted: "bg-danger-bg text-danger",
};

// 카테고리/기기구분 문자열을 안정적으로 팔레트에 매핑해 같은 값은 항상 같은 색으로 보이게 한다.
const BADGE_PALETTE = [
  "bg-blue-50 text-blue-700",
  "bg-emerald-50 text-emerald-700",
  "bg-amber-50 text-amber-700",
  "bg-purple-50 text-purple-700",
  "bg-pink-50 text-pink-700",
  "bg-teal-50 text-teal-700",
  "bg-indigo-50 text-indigo-700",
  "bg-cyan-50 text-cyan-700",
];

function colorForBadge(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return BADGE_PALETTE[hash % BADGE_PALETTE.length]!;
}

interface RowView {
  id: string;
  badge?: string;
  title: string;
  subtitle?: string;
  bodyLines: { label: string; value: string }[];
  searchText: string;
}

function nonEmpty(lines: { label: string; value: string }[]): { label: string; value: string }[] {
  return lines.filter((line) => line.value.trim().length > 0);
}

function toRowView(type: EntityType, item: Record<string, unknown>): RowView {
  const str = (v: unknown) => String(v ?? "");

  if (type === "policy") {
    const policyName = str(item.policyName);
    const subItem = str(item.subItem);
    return {
      id: str(item.id),
      badge: str(item.category) || undefined,
      title: policyName,
      subtitle: subItem || undefined,
      bodyLines: nonEmpty([
        { label: "설명1(규칙/포맷)", value: str(item.ruleDesc) },
        { label: "설명2(상세설명)", value: str(item.detailDesc) },
        { label: "예시", value: str(item.example) },
      ]),
      searchText: [policyName, subItem, item.ruleDesc, item.detailDesc, item.example].join(" ").toLowerCase(),
    };
  }

  if (type === "term") {
    const standardTerm = str(item.standardTerm);
    const synonyms = Array.isArray(item.synonyms) ? (item.synonyms as string[]) : [];
    return {
      id: str(item.id),
      title: standardTerm,
      subtitle: synonyms.length > 0 ? synonyms.join(", ") : str(item.uiMenu) || undefined,
      bodyLines: nonEmpty([
        { label: "개념(정의)", value: str(item.definition) },
        { label: "노출 메뉴", value: str(item.uiMenu) },
        { label: "비고", value: str(item.note) },
      ]),
      searchText: [standardTerm, ...synonyms, item.definition, item.uiMenu, item.note].join(" ").toLowerCase(),
    };
  }

  const termsName = str(item.termsName);
  return {
    id: str(item.id),
    badge: str(item.deviceCategory) || undefined,
    title: termsName,
    subtitle: str(item.manageCode) || undefined,
    bodyLines: nonEmpty([
      { label: "사용여부", value: str(item.useStatus) },
      { label: "필수여부", value: str(item.requiredStatus) },
      { label: "파일명", value: str(item.fileName) },
      { label: "개정일자", value: str(item.revisionDate) },
    ]),
    searchText: [termsName, item.manageCode, item.fileName, item.deviceCategory].join(" ").toLowerCase(),
  };
}

interface ActivityEntry {
  id: string;
  entityType: EntityType;
  entityId: string;
  action: "created" | "revised" | "deleted";
  label: string;
  actor: string;
  at: string;
  snapshot?: Record<string, unknown>;
  previousSnapshot?: Record<string, unknown>;
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

function renderSnapshotLines(entityType: EntityType, snapshot: Record<string, unknown>) {
  const labels = FIELD_LABELS[entityType];
  return Object.keys(labels)
    .filter((key) => key !== "author" && key !== "updatedAt")
    .map((key) => {
      const value = snapshot[key];
      const display = Array.isArray(value) ? value.join(", ") : String(value ?? "");
      if (!display.trim()) return null;
      return (
        <p key={key}>
          <span className="text-xs text-subtle">{labels[key]}: </span>
          <span className="whitespace-pre-wrap text-ink">{display}</span>
        </p>
      );
    })
    .filter(Boolean);
}

export default function PolicyListView() {
  const [activeTab, setActiveTab] = useState<ViewTab>("policy");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [activityItems, setActivityItems] = useState<ActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isEntityTab = activeTab !== "activity";

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setConfirmDeleteId(null);
    const endpoint = isEntityTab ? ENTITY_ENDPOINT[activeTab as EntityType] : "/api/activity";
    fetch(endpoint)
      .then((res) => res.json())
      .then((data) => {
        if (isEntityTab) setItems(data.items ?? []);
        else setActivityItems(data.items ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setIsLoading(false));
  }, [activeTab, isEntityTab]);

  const rows = useMemo(
    () => (isEntityTab ? items.map((item) => toRowView(activeTab as EntityType, item)) : []),
    [items, activeTab, isEntityTab],
  );
  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => row.searchText.includes(needle));
  }, [rows, query]);

  const filteredActivity = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return activityItems;
    return activityItems.filter((entry) =>
      [entry.label, entry.actor, ACTION_LABEL[entry.action]].join(" ").toLowerCase().includes(needle),
    );
  }, [activityItems, query]);

  function toggleOpen(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleConfirmDelete(id: string) {
    if (!isEntityTab) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${ENTITY_ENDPOINT[activeTab as EntityType]}/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "삭제에 실패했습니다.");
      setItems((prev) => prev.filter((item) => String(item.id) !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-border px-6 py-5">
        <h1 className="mb-4 text-xl font-semibold text-ink">등록된 항목 목록</h1>
        <div className="mb-3 flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab);
                setQuery("");
              }}
              className={`rounded-control px-3 py-1.5 text-sm font-medium ${
                activeTab === tab ? "bg-primary/10 text-primary" : "text-subtle hover:bg-page-bg"
              }`}
            >
              {TAB_LABEL[tab]}
            </button>
          ))}
        </div>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isEntityTab ? "정책명, 세부항목, 설명으로 검색" : "대상, 작업자로 검색"}
            className="w-full rounded-control border border-border py-2.5 pl-9 pr-3 text-sm text-ink focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6">
        {error && <p className="py-4 text-sm text-danger">{error}</p>}
        {isLoading ? (
          <p className="py-10 text-center text-sm text-subtle">불러오는 중...</p>
        ) : isEntityTab ? (
          filteredRows.length === 0 ? (
            <p className="py-10 text-center text-sm text-subtle">등록된 항목이 없습니다.</p>
          ) : (
            <div className="divide-y divide-border-subtle">
              {filteredRows.map((row) => {
                const isOpen = openIds.has(row.id);
                const isConfirming = confirmDeleteId === row.id;
                return (
                  <div key={row.id}>
                    <div className="flex items-center gap-2 py-3">
                      <button
                        type="button"
                        onClick={() => toggleOpen(row.id)}
                        className="flex flex-1 items-center gap-3 text-left hover:opacity-80"
                      >
                        {row.badge && (
                          <span
                            className={`shrink-0 rounded-pill px-2.5 py-0.5 text-xs font-medium ${colorForBadge(row.badge)}`}
                          >
                            {row.badge}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">{row.title}</span>
                          {row.subtitle && <span className="block truncate text-xs text-subtle">{row.subtitle}</span>}
                        </span>
                        <ChevronDownIcon
                          className={`size-4 shrink-0 text-subtle transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                      {isConfirming ? (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="text-xs text-danger">삭제할까요?</span>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => handleConfirmDelete(row.id)}
                            className="rounded-control bg-danger px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed"
                          >
                            {isDeleting ? "삭제 중..." : "확인"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-control px-2.5 py-1 text-xs text-subtle hover:bg-page-bg"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(row.id)}
                          className="shrink-0 rounded-control px-2.5 py-1 text-xs text-subtle hover:bg-danger-bg hover:text-danger"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                    {isOpen && (
                      <div className="space-y-1.5 pb-4 pl-1 pr-8 text-sm">
                        {row.bodyLines.length === 0 ? (
                          <p className="text-subtle">추가 설명이 없습니다.</p>
                        ) : (
                          row.bodyLines.map((line) => (
                            <p key={line.label}>
                              <span className="text-xs text-subtle">{line.label}: </span>
                              <span className="whitespace-pre-wrap text-ink">{line.value}</span>
                            </p>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : filteredActivity.length === 0 ? (
          <p className="py-10 text-center text-sm text-subtle">활동 이력이 없습니다.</p>
        ) : (
          <div className="divide-y divide-border-subtle">
            {filteredActivity.map((entry) => {
              const isOpen = openIds.has(entry.id);
              return (
                <div key={entry.id}>
                  <button
                    type="button"
                    onClick={() => toggleOpen(entry.id)}
                    className="flex w-full items-center gap-3 py-3 text-left hover:bg-page-bg/60"
                  >
                    <span
                      className={`shrink-0 rounded-pill px-2.5 py-0.5 text-xs font-medium ${ACTION_BADGE[entry.action]}`}
                    >
                      {ACTION_LABEL[entry.action]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{entry.label}</span>
                      <span className="block truncate text-xs text-subtle">
                        {formatDateTime(entry.at)} · {entry.actor}
                      </span>
                    </span>
                    <ChevronDownIcon
                      className={`size-4 shrink-0 text-subtle transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="space-y-3 pb-4 pl-1 pr-8 text-sm">
                      {entry.action === "revised" && entry.previousSnapshot && (
                        <div>
                          <p className="mb-1 text-xs font-medium text-subtle">변경 전</p>
                          <div className="space-y-1 rounded-control bg-page-bg p-3">
                            {renderSnapshotLines(entry.entityType, entry.previousSnapshot)}
                          </div>
                        </div>
                      )}
                      {entry.snapshot && (
                        <div>
                          <p className="mb-1 text-xs font-medium text-subtle">
                            {entry.action === "deleted" ? "삭제 당시 내용" : entry.action === "revised" ? "변경 후" : "등록 내용"}
                          </p>
                          <div className="space-y-1 rounded-control bg-page-bg p-3">
                            {renderSnapshotLines(entry.entityType, entry.snapshot)}
                          </div>
                        </div>
                      )}
                      {!entry.snapshot && <p className="text-subtle">상세 내용이 없습니다.</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-border px-6 py-3">
        <span className="text-xs text-subtle">
          총 {isEntityTab ? filteredRows.length : filteredActivity.length}건
        </span>
      </div>
    </div>
  );
}
