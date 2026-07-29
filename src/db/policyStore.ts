import { env } from "../config/env";
import type { PolicyFields } from "../types/policy";
import { createRecordStore } from "./recordStore";

/** 구분+정책명+세부항목이 같으면 같은 정책으로 보고 신규 대신 개정 처리한다. */
function keyOf(fields: PolicyFields): string {
  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "");
  return [normalize(fields.category), normalize(fields.policyName), normalize(fields.subItem)].join("|");
}

function searchableText(fields: PolicyFields): string {
  return [fields.category, fields.policyName, fields.subItem, fields.ruleDesc, fields.detailDesc, fields.example].join(
    " ",
  );
}

export const policyStore = createRecordStore<PolicyFields>({
  filePath: env.POLICIES_DATA_PATH,
  keyOf,
  searchableText,
});
