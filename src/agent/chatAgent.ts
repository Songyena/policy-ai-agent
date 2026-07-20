import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env";
import { getAllPolicies, searchPolicies } from "../db/knowledgeStore";
import type { PolicyRecord } from "../types/policy";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `당신은 사내 정책 지식창고를 안내하는 어시스턴트입니다.
아래에 주어진 "지식창고 정책 목록"에 있는 내용만 근거로 답변하세요.
목록에 없는 내용은 추측하지 말고, 근거가 없으면 "현재 지식창고에서 해당 내용을 찾을 수 없습니다"라고 답하세요.
답변할 때는 근거가 된 정책의 제목을 함께 언급하세요.`;

function formatPolicyContext(policies: PolicyRecord[]): string {
  if (policies.length === 0) return "(관련된 정책을 찾지 못했습니다)";
  return policies
    .map(
      (p) =>
        `- [${p.title}] (분류: ${p.category}, 키워드: ${p.keywords.join(", ")})\n  ${p.description}`,
    )
    .join("\n");
}

/**
 * 채팅형 지식창고: 사용자의 자연어 질문에 대해 db(승인된 정책만 보유)에서
 * 관련 정책을 검색한 뒤, 그 내용만 근거로 답변을 생성한다.
 */
export async function askPolicyQuestion(question: string): Promise<string> {
  const directHits = searchPolicies(question);

  // 검색어로 못 찾은 경우, 전체 정책이 많지 않다면 전체를 컨텍스트로 준다 (MVP 수준의 폴백).
  const allPolicies = getAllPolicies();
  const contextPolicies =
    directHits.length > 0 ? directHits : allPolicies.slice(0, 20);

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `지식창고 정책 목록:\n${formatPolicyContext(contextPolicies)}\n\n질문: ${question}`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.text ?? "";
}
