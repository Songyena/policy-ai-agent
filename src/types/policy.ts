import { z } from "zod";

/**
 * 정책(Policies) 고정 스키마. 엑셀 '정책' 시트 컬럼과 1:1 대응한다.
 * author/updatedAt은 사용자가 직접 입력하지 않고 로그인 사용자/등록(수정) 시각으로 서버가 채운다.
 */
export const PolicyFieldsSchema = z.object({
  category: z.string().default(""), // 구분 (예: 채번규칙, 결제정책, 시스템연동 등)
  policyName: z.string().min(1), // 정책명
  subItem: z.string().default(""), // 세부항목 (예: 신용평가등급확인서, AI경영진단 등)
  ruleDesc: z.string().default(""), // 설명1: 규칙/포맷 공식
  detailDesc: z.string().default(""), // 설명2: 상세 설명
  example: z.string().default(""), // 예시 (예: CV2411120001)
  author: z.string().min(1), // 작성/수정자
  updatedAt: z.string().min(1), // 작성/수정일 (ISO 8601)
});
export type PolicyFields = z.infer<typeof PolicyFieldsSchema>;

/** 대화형 등록에서 사용자가 아직 채우지 못한 필드를 허용하는 초안(draft) 형태. */
export const PolicyDraftFieldsSchema = PolicyFieldsSchema.partial();
export type PolicyDraftFields = z.infer<typeof PolicyDraftFieldsSchema>;

/**
 * 등록/조회 화면에서 필수로 취급하는 필드. 정책명 외에는 전부 선택 항목이다 —
 * author/updatedAt은 서버가 채우므로 이 목록에 없다.
 */
export const POLICY_REQUIRED_FIELDS = ["policyName"] as const satisfies readonly (keyof PolicyFields)[];

export const PolicyRecordSchema = PolicyFieldsSchema.extend({
  id: z.string(),
  revision: z.number(),
  history: z.array(PolicyFieldsSchema),
});
export type PolicyRecord = z.infer<typeof PolicyRecordSchema>;

export const POLICY_FIELD_LABELS: Record<keyof PolicyFields, string> = {
  category: "구분",
  policyName: "정책명",
  subItem: "세부항목",
  ruleDesc: "설명1(규칙/포맷)",
  detailDesc: "설명2(상세설명)",
  example: "예시",
  author: "작성/수정자",
  updatedAt: "작성/수정일",
};
