import { env } from "../config/env";
import type { TermsConditionsFields } from "../types/termsConditions";
import { createRecordStore } from "./recordStore";

/**
 * 관리코드가 있으면 그 값으로, 없으면(관리코드는 선택 항목이다) 약관명+기기구분으로 같은 항목인지
 * 판단한다. 관리코드가 비어있다고 전부 같은 키("")로 취급하면 서로 다른 약관 항목들이 하나로
 * 뭉개져 버리므로(먼저 등록한 게 나중 등록으로 덮어써짐) 반드시 대체 키가 필요하다.
 */
function keyOf(fields: TermsConditionsFields): string {
  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "");
  const manageCode = normalize(fields.manageCode);
  if (manageCode) return manageCode;
  return `name:${normalize(fields.termsName)}|${normalize(fields.deviceCategory)}`;
}

function searchableText(fields: TermsConditionsFields): string {
  return [fields.termsName, fields.manageCode, fields.deviceCategory, fields.fileName].join(" ");
}

export const termsConditionsStore = createRecordStore<TermsConditionsFields>({
  filePath: env.TERMS_CONDITIONS_DATA_PATH,
  keyOf,
  searchableText,
});
