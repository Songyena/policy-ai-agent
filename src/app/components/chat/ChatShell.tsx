"use client";

import { useCallback, useEffect, useState } from "react";
import PolicyListView from "../policies/PolicyListView";
import Sidebar, { type SidebarView } from "../Sidebar";
import ChatWindow from "./ChatWindow";
import type { SessionSummary } from "./types";

interface ChatShellProps {
  userName: string;
}

export default function ChatShell({ userName }: ChatShellProps) {
  const [activeView, setActiveView] = useState<SidebarView>("chat");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined);
  // ChatWindow에 이 값을 key로 줘서, 세션을 전환/새로 시작할 때만 강제로 다시 마운트되게 한다
  // (메시지를 주고받는 동안 sessionId가 자연스레 바뀌는 것과는 구분해야 하므로 별도 카운터를 쓴다).
  const [chatInstanceKey, setChatInstanceKey] = useState(0);

  const refreshSessions = useCallback(() => {
    fetch("/api/chat/sessions")
      .then((res) => res.json())
      .then((data) => setSessions(data.items ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  function handleSelectSession(sessionId: string) {
    setActiveSessionId(sessionId);
    setActiveView("chat");
    setChatInstanceKey((key) => key + 1);
  }

  function handleNewChat() {
    setActiveSessionId(undefined);
    setActiveView("chat");
    setChatInstanceKey((key) => key + 1);
  }

  /** ChatWindow가 대화 중 세션을 생성/갱신할 때마다 호출 — 목록을 최신 상태로 유지한다. */
  function handleSessionUpdate(sessionId: string) {
    setActiveSessionId(sessionId);
    refreshSessions();
  }

  /** 사이드바의 "삭제" 메뉴에서 호출. 지금 보고 있던 대화를 지운 경우 빈 화면으로 되돌린다. */
  async function handleDeleteSession(sessionId: string) {
    const res = await fetch(`/api/chat/sessions/${sessionId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "삭제에 실패했습니다.");

    setSessions((prev) => prev.filter((session) => session.id !== sessionId));
    if (sessionId === activeSessionId) {
      setActiveSessionId(undefined);
      setChatInstanceKey((key) => key + 1);
    }
  }

  return (
    <div className="flex h-screen bg-page-bg">
      <Sidebar
        userName={userName}
        activeView={activeView}
        onChangeView={setActiveView}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
      />
      <main className="flex-1 overflow-hidden">
        {activeView === "chat" ? (
          <ChatWindow
            key={chatInstanceKey}
            userName={userName}
            initialSessionId={activeSessionId}
            onSessionUpdate={handleSessionUpdate}
          />
        ) : (
          <PolicyListView />
        )}
      </main>
    </div>
  );
}
