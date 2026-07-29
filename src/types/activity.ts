import { z } from "zod";

export const ENTITY_TYPES = ["policy", "term", "termsConditions"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/**
 * 지식창고(정책/용어/이용약관)에 항목이 신규 등록/개정/삭제될 때마다 남기는 활동 로그 한 건.
 * 각 스토어(policyStore/termStore/termsConditionsStore)의 revision history와 별개로,
 * "누가 언제 무엇을 했는지"를 엔티티 종류에 상관없이 한 곳에서 조회하기 위한 것이다.
 */
export const ActivityLogEntrySchema = z.object({
  id: z.string(),
  entityType: z.enum(ENTITY_TYPES),
  entityId: z.string(),
  action: z.enum(["created", "revised", "deleted"]),
  label: z.string(), // 표시용 대표 명칭 (policyName/standardTerm/termsName)
  actor: z.string(),
  at: z.string(), // ISO 8601
});
export type ActivityLogEntry = z.infer<typeof ActivityLogEntrySchema>;
