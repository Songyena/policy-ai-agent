/**
 * 1회성 마이그레이션: 이전 버전(동적 mainCategory/category/fields 구조)의
 * data/knowledge/policy.json 레코드를 새 고정 스키마(정책/용어/이용약관) 3개 스토어로 옮긴다.
 *
 * 실행: npm run migrate:legacy
 *
 * 원본 파일(data/knowledge/policy.json)은 건드리지 않는다 — 실패하거나 재실행이 필요하면
 * 언제든 다시 돌릴 수 있도록 읽기 전용으로만 사용한다. 이미 새 스토어에 같은 키(구분+정책명+세부항목,
 * 표준용어, 관리코드)가 있으면 신규 대신 개정으로 처리되므로 여러 번 실행해도 중복 생성되지 않는다.
 */
import { existsSync, readFileSync } from "node:fs";
import { env } from "../src/config/env";
import { policyStore } from "../src/db/policyStore";
import { termStore } from "../src/db/termStore";
import { termsConditionsStore } from "../src/db/termsConditionsStore";
import type { PolicyFields } from "../src/types/policy";
import type { TermFields } from "../src/types/term";
import type { TermsConditionsFields } from "../src/types/termsConditions";

interface LegacyFieldEntry {
  key: string;
  value: string;
}

interface LegacyPolicyRecord {
  id: string;
  mainCategory: string;
  category: string;
  title: string;
  fields: LegacyFieldEntry[];
  confirmedAt: string;
  createdBy: string;
  updatedBy: string;
}

const LEGACY_PATH = "./data/knowledge/policy.json";

function getAny(fields: LegacyFieldEntry[], keys: string[]): string {
  for (const key of keys) {
    const entry = fields.find((f) => f.key === key);
    if (entry && entry.value.trim()) return entry.value.trim();
  }
  return "";
}

function dumpFields(fields: LegacyFieldEntry[]): string {
  return fields
    .filter((f) => f.value.trim() && !f.key.startsWith("__EMPTY"))
    .map((f) => `${f.key}: ${f.value}`)
    .join("\n");
}

function normalizeChoice(raw: string, allowed: string[], fallback: string): { value: string; mismatched: boolean } {
  if (!raw) return { value: fallback, mismatched: false };
  if (allowed.includes(raw)) return { value: raw, mismatched: false };
  return { value: fallback, mismatched: true };
}

type Classification = "term" | "termsConditions" | "policy";

function classify(fields: LegacyFieldEntry[]): Classification {
  if (getAny(fields, ["용어1"])) return "term";
  if (getAny(fields, ["약관명"])) return "termsConditions";
  return "policy";
}

function toTermFields(record: LegacyPolicyRecord): TermFields {
  const { fields } = record;
  return {
    standardTerm: getAny(fields, ["용어1"]) || record.title,
    synonyms: ["용어2", "용어3", "용어4"].map((k) => getAny(fields, [k])).filter(Boolean),
    uiMenu: getAny(fields, ["메뉴"]),
    definition: getAny(fields, ["개념", "내용"]) || "(마이그레이션됨 - 원본에 개념 없음)",
    note: getAny(fields, ["비고"]),
    author: getAny(fields, ["작성/수정자", "작성자(수정자)", "작성자"]) || record.updatedBy,
    updatedAt: getAny(fields, ["작성/수정일", "작성일(수정일)", "작성일"]) || record.confirmedAt,
  };
}

function toTermsConditionsFields(
  record: LegacyPolicyRecord,
): { fields: TermsConditionsFields; mismatches: string[] } {
  const { fields } = record;
  const mismatches: string[] = [];

  const useStatus = normalizeChoice(getAny(fields, ["사용여부"]), ["사용", "미사용"], "사용");
  if (useStatus.mismatched) mismatches.push("사용여부");
  const requiredStatus = normalizeChoice(getAny(fields, ["필수여부"]), ["필수", "선택"], "필수");
  if (requiredStatus.mismatched) mismatches.push("필수여부");

  const devCode = getAny(fields, ["관리코드\n(개발기)"]);
  const prodCode = getAny(fields, ["관리코드\n(운영기)"]);
  const manageCode =
    getAny(fields, ["관리코드"]) ||
    [...new Set([devCode, prodCode].filter(Boolean))].join(" / ") ||
    getAny(fields, ["관리코드_제정일_버전"]) ||
    `(미상)-${record.id.slice(0, 8)}`;

  return {
    fields: {
      useStatus: useStatus.value as TermsConditionsFields["useStatus"],
      requiredStatus: requiredStatus.value as TermsConditionsFields["requiredStatus"],
      deviceCategory: getAny(fields, ["기기구분"]) || "공통",
      termsName: getAny(fields, ["약관명"]) || record.title,
      fileName: getAny(fields, ["파일명", "파일명(IT기획팀관리용)", "파일명 제외 확장자"]),
      manageCode,
      revisionDate: getAny(fields, ["제정일(개정일)", "제정일\n(개정일)"]) || record.confirmedAt.slice(0, 10),
      author: record.updatedBy,
      updatedAt: record.confirmedAt,
    },
    mismatches,
  };
}

function toPolicyFields(record: LegacyPolicyRecord): { fields: PolicyFields; wasFallback: boolean } {
  const { fields } = record;
  const hasStructuredPolicyColumns = Boolean(getAny(fields, ["정책명", "세부항목", "설명1"]));

  if (hasStructuredPolicyColumns) {
    return {
      fields: {
        category: getAny(fields, ["구분"]) || record.category,
        policyName: getAny(fields, ["정책명"]) || record.title,
        subItem: getAny(fields, ["세부항목"]),
        ruleDesc: getAny(fields, ["설명1"]) || "(마이그레이션됨 - 원본에 설명1 없음)",
        detailDesc: getAny(fields, ["설명2"]),
        example: getAny(fields, ["예시"]) || "(미상)",
        author: getAny(fields, ["작성자(수정자)", "작성자"]) || record.updatedBy,
        updatedAt: getAny(fields, ["작성일(수정일)", "작성일"]) || record.confirmedAt,
      },
      wasFallback: false,
    };
  }

  // 정책/용어/약관 어느 구조에도 맞지 않는 레코드(기타/알림 등)는 내용을 잃지 않도록
  // 원본 필드를 통째로 설명란에 덤프한다. 마이그레이션 후 수동 정리가 필요하다.
  return {
    fields: {
      category: `${record.mainCategory} / ${record.category}`,
      policyName: record.title,
      subItem: "",
      ruleDesc: dumpFields(fields) || "(원본 내용 없음)",
      detailDesc: "",
      example: "(미상)",
      author: record.updatedBy,
      updatedAt: record.confirmedAt,
    },
    wasFallback: true,
  };
}

function main() {
  if (!existsSync(LEGACY_PATH)) {
    console.log(`레거시 파일이 없습니다(${LEGACY_PATH}) - 마이그레이션할 데이터가 없습니다.`);
    return;
  }

  const legacy = JSON.parse(readFileSync(LEGACY_PATH, "utf-8")) as { policies: LegacyPolicyRecord[] };
  console.log(`레거시 레코드 ${legacy.policies.length}건을 읽었습니다. (POLICIES_DATA_PATH=${env.POLICIES_DATA_PATH})`);

  const counts = { term: 0, termsConditions: 0, policy: 0 };
  const fallbackPolicies: string[] = [];
  const enumMismatches: string[] = [];

  for (const record of legacy.policies) {
    const type = classify(record.fields);

    if (type === "term") {
      const fields = toTermFields(record);
      termStore.create(fields);
      counts.term += 1;
    } else if (type === "termsConditions") {
      const { fields, mismatches } = toTermsConditionsFields(record);
      termsConditionsStore.create(fields);
      counts.termsConditions += 1;
      if (mismatches.length > 0) {
        enumMismatches.push(`${fields.termsName} (${record.id}): ${mismatches.join(", ")}`);
      }
    } else {
      const { fields, wasFallback } = toPolicyFields(record);
      policyStore.create(fields);
      counts.policy += 1;
      if (wasFallback) fallbackPolicies.push(`${fields.policyName} (${record.mainCategory}/${record.category})`);
    }
  }

  console.log("\n=== 마이그레이션 결과 ===");
  console.log(`정책: ${counts.policy}건, 용어: ${counts.term}건, 이용약관: ${counts.termsConditions}건`);

  if (fallbackPolicies.length > 0) {
    console.log(`\n[검토 필요] 정책 스키마에 맞지 않아 원본 내용을 설명1에 통째로 옮긴 항목 (${fallbackPolicies.length}건):`);
    for (const label of fallbackPolicies) console.log(`  - ${label}`);
  }
  if (enumMismatches.length > 0) {
    console.log(`\n[검토 필요] 사용여부/필수여부 값이 예상 범위를 벗어나 기본값으로 대체된 항목 (${enumMismatches.length}건):`);
    for (const label of enumMismatches) console.log(`  - ${label}`);
  }
}

main();
