"use client";

import { useState } from "react";
import PolicyListView from "../policies/PolicyListView";
import Sidebar, { type SidebarView } from "../Sidebar";
import ChatWindow from "./ChatWindow";

interface ChatShellProps {
  userName: string;
}

export default function ChatShell({ userName }: ChatShellProps) {
  const [activeView, setActiveView] = useState<SidebarView>("chat");

  return (
    <div className="flex h-screen bg-page-bg">
      <Sidebar userName={userName} activeView={activeView} onChangeView={setActiveView} />
      <main className="flex-1 overflow-hidden">
        {activeView === "chat" ? <ChatWindow userName={userName} /> : <PolicyListView />}
      </main>
    </div>
  );
}
