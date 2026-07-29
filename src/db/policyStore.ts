import { env } from "../config/env";
import type { PolicyFields } from "../types/policy";
import { createRecordStore } from "./recordStore";

/**
 * 정책명+세부항목이 같으면 같은 정책으로 보고 신규 대신 개정 처리한다. 구분(category)은 선택
 * 항목이라 값이 비어있거나 사람마다 다르게 적을 수 있어 키에서 뺀다 — 넣으면 같은 정책이
 * 구분 표기 차이로 중복 저장될 수 있다.
 */
function keyOf(fields: PolicyFields): string {
  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "");
  return [normalize(fields.policyName), normalize(fields.subItem)].join("|");
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
