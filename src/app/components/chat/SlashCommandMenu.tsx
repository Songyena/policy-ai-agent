import type { EntityType } from "./types";

export interface SlashCommand {
  command: string; // "/" 뒤에 오는 텍스트 (예: "정책")
  mode: EntityType | "excel";
  label: string;
  description: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { command: "정책", mode: "policy", label: "/정책", description: "정책 등록/조회" },
  { command: "용어", mode: "term", label: "/용어", description: "표준 용어(유사어) 등록/조회" },
  { command: "약관", mode: "termsConditions", label: "/약관", description: "이용약관 항목 등록/조회" },
  { command: "엑셀", mode: "excel", label: "/엑셀", description: "엑셀 파일 업로드 및 일괄 등록/검증" },
];

interface SlashCommandMenuProps {
  filter: string;
  onSelect: (command: SlashCommand) => void;
}

export default function SlashCommandMenu({ filter, onSelect }: SlashCommandMenuProps) {
  const matches = SLASH_COMMANDS.filter((c) => c.command.includes(filter) || c.mode.includes(filter));

  if (matches.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 mb-2 w-full overflow-hidden rounded-card border border-border bg-surface shadow-card">
      <div className="border-b border-border-subtle px-3 py-1.5 text-xs font-medium text-subtle">
        빠른 명령
      </div>
      <ul>
        {matches.map((c) => (
          <li key={c.command}>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(c)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-page-bg"
            >
              <span className="font-mono text-sm font-medium text-primary">{c.label}</span>
              <span className="text-xs text-subtle">{c.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
