import type { PolicyFields, PolicyRecord } from "../types/policy";
import type { TermFields, TermRecord } from "../types/term";
import type { TermsConditionsFields, TermsConditionsRecord } from "../types/termsConditions";
import { initActivityLog, logActivity } from "./activityLog";
import { policyStore } from "./policyStore";
import { termStore } from "./termStore";
import { termsConditionsStore } from "./termsConditionsStore";

export interface RegisterResult<TRecord> {
  record: TRecord;
  /** 같은 항목(중복 키)이 이미 있어 신규 생성 대신 개정으로 처리된 경우 true. */
  wasRevision: boolean;
}

/** 정책을 신규 등록(또는 동일 항목이면 개정)하고 활동 로그를 남긴다. */
export function registerPolicy(fields: PolicyFields, actor: string): RegisterResult<PolicyRecord> {
  const { record, wasRevision } = policyStore.create(fields);
  logActivity({
    entityType: "policy",
    entityId: record.id,
    action: wasRevision ? "revised" : "created",
    label: record.policyName,
    actor,
    at: record.updatedAt,
  });
  return { record, wasRevision };
}

/** 용어를 신규 등록(또는 동일 표준 용어면 개정)하고 활동 로그를 남긴다. */
export function registerTerm(fields: TermFields, actor: string): RegisterResult<TermRecord> {
  const { record, wasRevision } = termStore.create(fields);
  logActivity({
    entityType: "term",
    entityId: record.id,
    action: wasRevision ? "revised" : "created",
    label: record.standardTerm,
    actor,
    at: record.updatedAt,
  });
  return { record, wasRevision };
}

/** 이용약관 항목을 신규 등록(또는 동일 관리코드면 개정)하고 활동 로그를 남긴다. */
export function registerTermsConditions(
  fields: TermsConditionsFields,
  actor: string,
): RegisterResult<TermsConditionsRecord> {
  const { record, wasRevision } = termsConditionsStore.create(fields);
  logActivity({
    entityType: "termsConditions",
    entityId: record.id,
    action: wasRevision ? "revised" : "created",
    label: record.termsName,
    actor,
    at: record.updatedAt,
  });
  return { record, wasRevision };
}

export function initAllStores(): void {
  policyStore.init();
  termStore.init();
  termsConditionsStore.init();
  initActivityLog();
}
