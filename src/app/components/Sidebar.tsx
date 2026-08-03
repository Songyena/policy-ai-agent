"use client";

import { useState, type JSX } from "react";
import type { SessionSummary } from "./chat/types";
import LogoutButton from "./LogoutButton";

export type SidebarView = "chat" | "policies";

interface SidebarProps {
  userName: string;
  activeView: SidebarView;
  onChangeView: (view: SidebarView) => void;
  sessions: SessionSummary[];
  activeSessionId?: string;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
}

function MessageCircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function ChevronUpDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

const NAV_ITEMS: { view: SidebarView; label: string; Icon: (props: { className?: string }) => JSX.Element }[] = [
  { view: "chat", label: "대화", Icon: MessageCircleIcon },
  { view: "policies", label: "정책 목록", Icon: ListIcon },
];

/** "방금 전"/"3시간 전"/"어제" 같은 상대 시각. 세션 보관기간이 짧아(기본 24시간) 일 단위까지만 다룬다. */
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return "어제";
}

export default function Sidebar({
  userName,
  activeView,
  onChangeView,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
}: SidebarProps) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const initial = userName.trim().charAt(0) || "?";

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 px-4 py-5">
        <span className="flex size-8 items-center justify-center rounded-control bg-primary text-sm font-bold text-white">
          P
        </span>
        <span className="text-sm font-semibold text-ink">정책 Agent</span>
      </div>

      <nav className="px-3">
        <p className="px-2 pb-2 text-xs font-medium text-subtle">메인</p>
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ view, label, Icon }) => (
            <li key={view}>
              <button
                type="button"
                onClick={() => onChangeView(view)}
                className={`flex h-10 w-full items-center gap-2.5 rounded-control px-3 text-sm transition-colors ${
                  activeView === view
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-subtle hover:bg-page-bg hover:text-ink"
                }`}
              >
                <Icon className="size-5 shrink-0" />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-4 flex min-h-0 flex-1 flex-col px-3">
        <div className="mb-1 flex items-center justify-between px-2">
          <p className="text-xs font-medium text-subtle">이전 대화</p>
          <button
            type="button"
            onClick={onNewChat}
            title="새 대화"
            className="flex size-6 items-center justify-center rounded-control text-subtle hover:bg-page-bg hover:text-ink"
          >
            <PlusIcon className="size-4" />
          </button>
        </div>
        <ul className="flex-1 space-y-0.5 overflow-y-auto">
          {sessions.length === 0 && (
            <li className="px-2 py-2 text-xs text-subtle">최근 24시간 내 대화가 없습니다.</li>
          )}
          {sessions.map((session) => (
            <li key={session.id}>
              <button
                type="button"
                onClick={() => onSelectSession(session.id)}
                className={`block w-full rounded-control px-2 py-1.5 text-left transition-colors ${
                  session.id === activeSessionId
                    ? "bg-primary/10 text-primary"
                    : "text-ink hover:bg-page-bg"
                }`}
              >
                <span className="block truncate text-sm">{session.title || "제목 없음"}</span>
                <span className="block text-xs text-subtle">{relativeTime(session.updatedAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative m-3 mt-0">
        {accountMenuOpen && (
          <div className="absolute bottom-full left-0 mb-2 w-full overflow-hidden rounded-control border border-border bg-surface shadow-card">
            <div onClick={() => setAccountMenuOpen(false)}>
              <LogoutButton />
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setAccountMenuOpen((prev) => !prev)}
          className="flex w-full items-center gap-2.5 rounded-control border border-border px-2.5 py-2 text-left hover:bg-page-bg"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
            {initial}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{userName}님</span>
            <span className="block truncate text-xs text-subtle">My Workspace</span>
          </span>
          <ChevronUpDownIcon className="size-4 shrink-0 text-subtle" />
        </button>
      </div>
    </aside>
  );
}
