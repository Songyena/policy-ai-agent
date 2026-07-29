import LogoutButton from "../LogoutButton";
import ChatWindow from "./ChatWindow";

interface ChatShellProps {
  userName: string;
}

export default function ChatShell({ userName }: ChatShellProps) {
  return (
    <div className="flex h-screen flex-col bg-page-bg">
      <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
        <h1 className="text-base font-semibold text-ink">정책 Agent</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-subtle">{userName}님</span>
          <LogoutButton />
        </div>
      </header>
      <div className="flex-1 overflow-hidden">
        <ChatWindow />
      </div>
    </div>
  );
}
