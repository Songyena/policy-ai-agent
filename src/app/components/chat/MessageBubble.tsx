import ConfirmCard from "./ConfirmCard";
import type { DisplayMessage } from "./types";

interface MessageBubbleProps {
  message: DisplayMessage;
  onConfirmCard: (message: DisplayMessage) => Promise<void>;
  onCancelCard: (message: DisplayMessage) => void;
}

export default function MessageBubble({ message, onConfirmCard, onCancelCard }: MessageBubbleProps) {
  if (message.role === "system") {
    return (
      <div className="flex justify-center">
        <span className="rounded-pill bg-page-bg px-3 py-1 text-xs text-subtle">{message.content}</span>
      </div>
    );
  }

  const isUser = message.role === "user";

  return (
    <div className={`flex flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>
      {message.content && (
        <div
          className={
            isUser
              ? "max-w-[75%] whitespace-pre-wrap rounded-card bg-primary px-4 py-2.5 text-sm text-white"
              : "max-w-[75%] whitespace-pre-wrap rounded-card border border-border bg-surface px-4 py-2.5 text-sm text-ink shadow-card"
          }
        >
          {message.content}
        </div>
      )}
      {message.card && (
        <ConfirmCard
          card={message.card}
          status={message.cardStatus}
          onConfirm={(fields) => onConfirmCard({ ...message, card: { ...message.card!, fields } })}
          onCancel={() => onCancelCard(message)}
        />
      )}
    </div>
  );
}
