import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { env } from "../config/env";
import { findPoliciesByKeywords, getAllPolicies, getPolicyById } from "../db/knowledgeStore";
import type { PolicyRecord } from "../types/policy";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const ImpactSuggestionSchema = z.object({
  additionalKeywords: z.array(z.string()),
  explanation: z.string(),
});

export interface ImpactAnalysisResult {
  policy: PolicyRecord;
  /** 키워드가 겹쳐서 이미 연관성이 확인된 정책들 */
  relatedPolicies: PolicyRecord[];
  /** AI가 지식창고 내 기존 키워드 풀을 참고해 추가로 제안한 연관 키워드 */
  suggestedKeywords: string[];
  explanation: string;
}

const SYSTEM_PROMPT = `당신은 서비스 정책 변경의 영향도를 분석하는 어시스턴트입니다.
주어진 정책과, 지식창고에 이미 존재하는 키워드 목록을 참고하여
이 정책과 실질적으로 연관될 가능성이 있는 "기존 키워드"만 추가로 제안하세요.
지식창고에 없는 새로운 키워드를 지어내지 마세요.`;

/**
 * 기초 영향도 분석: 특정 정책을 언급했을 때
 * 1) 키워드가 이미 겹치는 정책(관계형 조회)과
 * 2) AI가 판단한 추가 연관 키워드
 * 를 함께 제공한다. 결과는 db(승인된 정책)만 근거로 삼는다.
 */
export async function analyzeImpact(policyId: string): Promise<ImpactAnalysisResult> {
  const policy = getPolicyById(policyId);
  if (!policy) {
    throw new Error(`지식창고에서 정책을 찾을 수 없습니다: ${policyId}`);
  }

  const relatedPolicies = findPoliciesByKeywords(policy.keywords, policy.id);

  const allKeywords = Array.from(
    new Set(getAllPolicies().flatMap((p) => p.keywords)),
  );

  const response = await client.beta.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `정책: ${policy.title}
분류: ${policy.category}
현재 키워드: ${policy.keywords.join(", ")}
설명: ${policy.description}

지식창고 내 전체 키워드 풀: ${allKeywords.join(", ")}

이 정책과 연관될 수 있는 기존 키워드를 (현재 키워드는 제외하고) 제안해주세요.`,
      },
    ],
    output_format: betaZodOutputFormat(ImpactSuggestionSchema),
  });

  const parsed = response.parsed_output;

  return {
    policy,
    relatedPolicies,
    suggestedKeywords: parsed?.additionalKeywords ?? [],
    explanation: parsed?.explanation ?? "",
  };
}
