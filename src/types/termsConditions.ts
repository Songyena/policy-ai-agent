import { z } from "zod";

/**
 * 이용약관(Terms & Conditions) 고정 스키마. 엑셀 '이용약관' 시트 컬럼과 1:1 대응한다.
 * author/updatedAt은 스펙 원본 컬럼에는 없지만, 다른 두 엔티티와 동일하게 등록/수정 이력을
 * 추적하기 위해 서버가 채워 넣는다(누가 이 관리코드를 등록했는지 알아야 하므로).
 */
export const TermsConditionsFieldsSchema = z.object({
  useStatus: z.enum(["사용", "미사용"]), // 사용여부
  requiredStatus: z.enum(["필수", "선택"]), // 필수여부
  deviceCategory: z.string().min(1), // 기기구분 (공통/iOS/Android/Web 등)
  termsName: z.string().min(1), // 약관명
  fileName: z.string().default(""), // 파일명
  manageCode: z.string().min(1), // 관리코드
  revisionDate: z.string().min(1), // 개정일자
  author: z.string().min(1), // 작성/수정자
  updatedAt: z.string().min(1), // 작성/수정일 (ISO 8601)
});
export type TermsConditionsFields = z.infer<typeof TermsConditionsFieldsSchema>;

export const TermsConditionsDraftFieldsSchema = TermsConditionsFieldsSchema.partial();
export type TermsConditionsDraftFields = z.infer<typeof TermsConditionsDraftFieldsSchema>;

export const TERMS_CONDITIONS_REQUIRED_FIELDS = [
  "useStatus",
  "requiredStatus",
  "deviceCategory",
  "termsName",
  "manageCode",
  "revisionDate",
] as const satisfies readonly (keyof TermsConditionsFields)[];

export const TermsConditionsRecordSchema = TermsConditionsFieldsSchema.extend({
  id: z.string(),
  revision: z.number(),
  history: z.array(TermsConditionsFieldsSchema),
});
export type TermsConditionsRecord = z.infer<typeof TermsConditionsRecordSchema>;

export const TERMS_CONDITIONS_FIELD_LABELS: Record<keyof TermsConditionsFields, string> = {
  useStatus: "사용여부",
  requiredStatus: "필수여부",
  deviceCategory: "기기구분",
  termsName: "약관명",
  fileName: "파일명",
  manageCode: "관리코드",
  revisionDate: "개정일자",
  author: "작성/수정자",
  updatedAt: "작성/수정일",
};
