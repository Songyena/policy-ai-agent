import { env } from "../config/env";
import type { TermsConditionsFields } from "../types/termsConditions";
import { createRecordStore } from "./recordStore";

/** 관리코드가 같으면 같은 약관 항목으로 보고 신규 대신 개정 처리한다. */
function keyOf(fields: TermsConditionsFields): string {
  return fields.manageCode.trim().toLowerCase().replace(/\s+/g, "");
}

function searchableText(fields: TermsConditionsFields): string {
  return [fields.termsName, fields.manageCode, fields.deviceCategory, fields.fileName].join(" ");
}

export const termsConditionsStore = createRecordStore<TermsConditionsFields>({
  filePath: env.TERMS_CONDITIONS_DATA_PATH,
  keyOf,
  searchableText,
});
