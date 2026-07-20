import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { env } from "../config/env";
import {
  PolicyCandidateDraftSchema,
  type PolicyCandidate,
  type RawPolicySource,
} from "../types/policy";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const CandidateBatchSchema = z.object({
  candidates: z.array(PolicyCandidateDraftSchema),
});

const SYSTEM_PROMPT = `당신은 서비스 정책 문서를 정리하는 어시스턴트입니다.
엑셀(.xlsx) 정책 표와 피그마 화면설계서에서 추출된 원문 조각들이 주어집니다.
각 조각(들)을 분석해 "정책 후보"를 만드세요. 하나의 정책 후보는 여러 원문 조각을
근거로 삼을 수 있습니다. 원문에 없는 내용을 추측해서 만들어내지 마세요.
category는 문서 내에서 반복적으로 등장하는 상위 분류(예: 배송, 결제, 회원, 환불 등)를 따르세요.
조각에 "카테고리 힌트"가 주어져 있다면, 원문 내용과 모순되지 않는 한 그 힌트를 category로 사용하세요.
confidence는 원문 근거가 얼마나 명확한지에 대한 0~1 사이의 자체 평가입니다.`;

/**
 * 2단계(refine)의 첫 단계: RawPolicySource 묶음을 보고 AI가
 * "정리된 정책 데이터 후보군"을 생성한다. 이 결과는 사용자 승인 전까지
 * status: "pending" 상태로만 존재하며 지식창고(db)에는 절대 직접 적재하지 않는다.
 */
export async function generateCandidates(
  sources: RawPolicySource[],
): Promise<PolicyCandidate[]> {
  if (sources.length === 0) return [];

  const sourceText = sources
    .map((s) => {
      const hint = s.categoryHint ? ` / 카테고리 힌트: ${s.categoryHint}` : "";
      return `[${s.id}] (${s.sourceType} / ${s.sourceRef}${hint})\n${s.rawText}`;
    })
    .join("\n\n---\n\n");

  const response = await client.beta.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `다음 원문 조각들로부터 정책 후보 목록을 만들어주세요:\n\n${sourceText}`,
      },
    ],
    output_format: betaZodOutputFormat(CandidateBatchSchema),
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error("정책 후보 생성에 실패했습니다 (구조화된 출력 파싱 실패).");
  }

  const createdAt = new Date().toISOString();
  const sourceIds = sources.map((s) => s.id);

  return parsed.candidates.map((draft: z.infer<typeof PolicyCandidateDraftSchema>) => ({
    id: randomUUID(),
    sourceIds,
    title: draft.title,
    description: draft.description,
    category: draft.category,
    keywords: draft.keywords,
    status: "pending" as const,
    confidence: draft.confidence,
    createdAt,
  }));
}
