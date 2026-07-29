import { env } from "../config/env";
import type { TermFields } from "../types/term";
import { createRecordStore } from "./recordStore";

/** 표준 용어가 같으면 같은 용어로 보고 신규 대신 개정 처리한다. */
function keyOf(fields: TermFields): string {
  return fields.standardTerm.trim().toLowerCase().replace(/\s+/g, "");
}

function searchableText(fields: TermFields): string {
  return [fields.standardTerm, ...fields.synonyms, fields.uiMenu, fields.definition, fields.note].join(" ");
}

export const termStore = createRecordStore<TermFields>({
  filePath: env.TERMS_DATA_PATH,
  keyOf,
  searchableText,
});
