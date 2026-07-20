import { z } from "zod";

/**
 * 1단계 (parser) 산출물 — 엑셀/피그마에서 그대로 추출한 원본 조각.
 * 정제 판단 없이 "어디서 왔는지"와 "원문"만 담는다.
 */
export const RawPolicySourceSchema = z.object({
  id: z.string(),
  sourceType: z.enum(["excel", "figma"]),
  sourceRef: z.string(), // 파일 경로, 시트명, Figma 노드 ID 등
  rawText: z.string(),
  /** 파일명/시트명을 카테고리에 매핑해 얻은 힌트. 최종 category 확정은 refine 단계의 AI가 담당한다. */
  categoryHint: z.string().optional(),
  extractedAt: z.string(), // ISO 8601
});
export type RawPolicySource = z.infer<typeof RawPolicySourceSchema>;

/**
 * 2단계 (refine) 산출물 — AI가 생성한 "정리된 정책 데이터 후보".
 * status가 "approved"가 되기 전까지는 지식창고(db)에 들어가지 않는다.
 */
export const PolicyCandidateSchema = z.object({
  id: z.string(),
  sourceIds: z.array(z.string()),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  keywords: z.array(z.string()),
  status: z.enum(["pending", "approved", "rejected"]),
  confidence: z.number().min(0).max(1),
  createdAt: z.string(),
});
export type PolicyCandidate = z.infer<typeof PolicyCandidateSchema>;

/** candidateGenerator가 Claude로부터 구조화된 출력으로 받는 원시 형태 (승인 전이므로 status/id 없음) */
export const PolicyCandidateDraftSchema = z.object({
  title: z.string(),
  description: z.string(),
  category: z.string(),
  keywords: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});
export type PolicyCandidateDraft = z.infer<typeof PolicyCandidateDraftSchema>;

/**
 * 3단계 (db) — 사용자가 승인한 최종 정책. 채팅/영향도 분석은 이 타입만 참조한다.
 */
export const PolicyRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  keywords: z.array(z.string()),
  sourceIds: z.array(z.string()),
  confirmedAt: z.string(),
});
export type PolicyRecord = z.infer<typeof PolicyRecordSchema>;
