import { z } from "zod";

/**
 * 용어(Glossary/Terms) 고정 스키마. 엑셀 '용어' 시트 컬럼과 1:1 대응한다.
 * 유사어(용어2~4)는 개수가 가변적이므로 배열로 통일한다.
 */
export const TermFieldsSchema = z.object({
  standardTerm: z.string().min(1), // 표준 용어
  synonyms: z.array(z.string().min(1)).default([]), // 유사어/혼용어
  uiMenu: z.string().min(1), // 노출 위치/메뉴
  definition: z.string().min(1), // 용어 정의
  note: z.string().default(""), // 비고
  author: z.string().min(1), // 작성/수정자
  updatedAt: z.string().min(1), // 작성/수정일 (ISO 8601)
});
export type TermFields = z.infer<typeof TermFieldsSchema>;

export const TermDraftFieldsSchema = TermFieldsSchema.partial();
export type TermDraftFields = z.infer<typeof TermDraftFieldsSchema>;

export const TERM_REQUIRED_FIELDS = [
  "standardTerm",
  "uiMenu",
  "definition",
] as const satisfies readonly (keyof TermFields)[];

export const TermRecordSchema = TermFieldsSchema.extend({
  id: z.string(),
  revision: z.number(),
  history: z.array(TermFieldsSchema),
});
export type TermRecord = z.infer<typeof TermRecordSchema>;

export const TERM_FIELD_LABELS: Record<keyof TermFields, string> = {
  standardTerm: "표준 용어",
  synonyms: "유사어",
  uiMenu: "노출 메뉴",
  definition: "개념(정의)",
  note: "비고",
  author: "작성/수정자",
  updatedAt: "작성/수정일",
};
