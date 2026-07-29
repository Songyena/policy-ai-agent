"use client";

import { useRef, useState } from "react";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import ExcelValidationModal, { type ExcelCommitSummary } from "./ExcelValidationModal";
import MessageBubble from "./MessageBubble";
import SlashCommandMenu, { SLASH_COMMANDS, type SlashCommand } from "./SlashCommandMenu";
import type { DisplayMessage } from "./types";

let messageIdCounter = 0;
function nextMessageId(): string {
  messageIdCounter += 1;
  return `msg-${messageIdCounter}`;
}

const INPUT_PLACEHOLDER =
  "정책/용어/이용약관을 물어보거나 등록해보세요 · '/'로 빠른 명령 · 📎로 엑셀 업로드";

export default function ChatWindow() {
  const [display, setDisplay] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [parsedWorkbook, setParsedWorkbook] = useState<{
    sheets: { type: "policy" | "term" | "termsConditions"; sheetName: string; rows: { rowIndex: number; fields: Record<string, unknown>; errors: Record<string, string> }[] }[];
    unrecognizedSheets: string[];
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const apiHistoryRef = useRef<ChatCompletionMessageParam[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function appendDisplay(message: DisplayMessage) {
    setDisplay((prev) => [...prev, message]);
  }

  function detectMode(text: string): string | undefined {
    const match = SLASH_COMMANDS.find((c) => c.mode !== "excel" && text.trim().startsWith(`/${c.command}`));
    return match?.mode;
  }

  function handleInputChange(value: string) {
    setInput(value);
    setShowSlashMenu(value.startsWith("/") && !value.includes(" "));
  }

  function handleSelectSlashCommand(command: SlashCommand) {
    setShowSlashMenu(false);
    if (command.mode === "excel") {
      setInput("");
      fileInputRef.current?.click();
      return;
    }
    setInput(`/${command.command} `);
    textareaRef.current?.focus();
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const mode = detectMode(trimmed);
    const userApiMessage: ChatCompletionMessageParam = { role: "user", content: trimmed };
    const nextHistory = [...apiHistoryRef.current, userApiMessage];
    apiHistoryRef.current = nextHistory;

    appendDisplay({ id: nextMessageId(), role: "user", content: trimmed });
    setInput("");
    setShowSlashMenu(false);
    setIsSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextHistory, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "응답을 받지 못했습니다.");

      apiHistoryRef.current = [...nextHistory, ...(data.appendedMessages ?? [])];
      appendDisplay({
        id: nextMessageId(),
        role: "assistant",
        content: data.reply ?? "",
        card: data.card,
        cardStatus: data.card ? "pending" : undefined,
      });
    } catch (err) {
      appendDisplay({
        id: nextMessageId(),
        role: "assistant",
        content: `오류가 발생했습니다: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setIsSending(false);
    }
  }

  async function handleConfirmCard(message: DisplayMessage) {
    if (!message.card) return;
    const res = await fetch("/api/registry/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: message.card.type, fields: message.card.fields }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "등록에 실패했습니다.");

    setDisplay((prev) =>
      prev.map((m) => (m.id === message.id ? { ...m, card: message.card, cardStatus: "confirmed" } : m)),
    );
    const label = data.record?.policyName ?? data.record?.standardTerm ?? data.record?.termsName ?? "항목";
    appendDisplay({
      id: nextMessageId(),
      role: "system",
      content: `${label} ${data.wasRevision ? "개정" : "등록"} 완료`,
    });
  }

  function handleCancelCard(message: DisplayMessage) {
    setDisplay((prev) => prev.map((m) => (m.id === message.id ? { ...m, cardStatus: "cancelled" } : m)));
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/excel/parse", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "엑셀 파싱에 실패했습니다.");
      setParsedWorkbook(data);
    } catch (err) {
      appendDisplay({
        id: nextMessageId(),
        role: "assistant",
        content: `엑셀 파싱 실패: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setIsUploading(false);
    }
  }

  function handleExcelCommitted(summary: ExcelCommitSummary) {
    const { committed, failed } = summary;
    const parts = [
      committed.policy > 0 && `정책 ${committed.policy}건`,
      committed.term > 0 && `용어 ${committed.term}건`,
      committed.termsConditions > 0 && `이용약관 ${committed.termsConditions}건`,
    ].filter(Boolean);
    const summaryText = parts.length > 0 ? `${parts.join(", ")} 등록 완료` : "등록된 항목이 없습니다";
    appendDisplay({
      id: nextMessageId(),
      role: "system",
      content: failed.length > 0 ? `${summaryText} (실패 ${failed.length}건)` : summaryText,
    });
    if (failed.length === 0) {
      setParsedWorkbook(null);
    }
  }

  const composer = (
    <div className="relative">
      {showSlashMenu && <SlashCommandMenu filter={input.slice(1)} onSelect={handleSelectSlashCommand} />}
      <div className="flex items-end gap-2">
        <button
          type="button"
          title="엑셀 업로드"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="rounded-control border border-border px-3 py-2 text-subtle hover:bg-page-bg disabled:cursor-not-allowed"
        >
          {isUploading ? "..." : "📎"}
        </button>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={1}
          placeholder={INPUT_PLACEHOLDER}
          className="flex-1 resize-none rounded-control border border-border px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={isSending || !input.trim()}
          className="rounded-control bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          전송
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileSelected} />

      {display.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <div className="w-full max-w-2xl">
            <h1 className="mb-6 text-center text-2xl font-semibold text-ink">정책 Agent</h1>
            {composer}
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="mx-auto flex max-w-2xl flex-col gap-4">
              {display.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onConfirmCard={handleConfirmCard}
                  onCancelCard={handleCancelCard}
                />
              ))}
              {isSending && <span className="text-xs text-subtle">생각하는 중...</span>}
            </div>
          </div>

          <div className="border-t border-border bg-surface px-6 py-4">
            <div className="mx-auto max-w-2xl">{composer}</div>
          </div>
        </>
      )}

      {parsedWorkbook && (
        <ExcelValidationModal
          sheets={parsedWorkbook.sheets}
          unrecognizedSheets={parsedWorkbook.unrecognizedSheets}
          onClose={() => setParsedWorkbook(null)}
          onCommitted={handleExcelCommitted}
        />
      )}
    </div>
  );
}
