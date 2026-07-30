import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { env } from "../config/env";
import { executeTool, TOOL_DEFINITIONS } from "./tools";

// Gemini의 OpenAI 호환 엔드포인트를 그대로 openai SDK로 호출한다 (baseURL/모델명만 다르다).
// https://ai.google.dev/gemini-api/docs/openai
const client = new OpenAI({
  apiKey: env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});
const MODEL = "gemini-3.1-flash-lite";

const MAX_TOOL_ITERATIONS = 6;

const SYSTEM_PROMPT = `당신은 사내 정책/용어(표준 용어집)/이용약관을 통합 관리하는 단일 대화창 어시스턴트입니다.

역할:
1. 조회: 사용자가 정책/용어/약관에 대해 물으면 반드시 search_knowledge 도구로 먼저 검색하고, 그 결과에 있는 내용만 근거로 답합니다. 검색 결과에 없으면 "현재 지식창고에서 해당 내용을 찾을 수 없습니다"라고 답하세요. 절대 추측하지 마세요.
2. 대화형 등록: 사용자가 정책/용어/약관을 새로 등록하려고 하면, 대화로 항목을 채웁니다. 각
   종류마다 이름에 해당하는 필드(정책명/표준 용어/약관명)만 필수이고 나머지는 전부 선택
   항목입니다 — 선택 항목은 사용자가 이미 언급했으면 반영하되, 없다고 캐묻지 마세요.
   - 정책: 정책명(필수) / 구분, 세부항목, 설명1(규칙/포맷), 설명2(상세설명), 예시(선택)
   - 용어: 표준 용어(필수) / 유사어(여러 개 가능), 노출 메뉴, 개념(정의), 비고(선택)
   - 이용약관: 약관명(필수) / 사용여부, 필수여부, 기기구분, 파일명, 관리코드, 개정일자(선택)
   사용자가 정보를 말할 때마다 지금까지 파악한 값을 모두 포함해서 해당 draft_* 도구를 호출하세요.
   도구가 돌려준 missingFields에 있는 항목(보통 이름 필드 하나)만 사용자에게 물어보세요.
   missingFields가 없어지면 지금까지 파악한 내용을 한국어로 간단히 요약하고 "아래 내용으로
   등록할까요?"라고 물어보세요 — 실제 등록은 화면의 확인 카드에서 사용자가 직접 버튼을 눌러야
   이뤄지므로, 당신이 등록을 완료했다고 말하지 마세요.
3. 사용자가 "/정책", "/용어", "/약관" 같은 슬래시 커맨드로 말을 시작하면 해당 종류의 등록/조회 의도로
   우선 해석하세요. "/엑셀"이나 "/파싱"은 파일 업로드로 별도 처리되므로 당신이 처리할 필요는 없습니다.

항상 한국어로, 간결하고 실무적인 어투로 답하세요.`;

export interface AgentTurnResult {
  reply: string;
  card?: { type: "policy" | "term" | "termsConditions"; fields: Record<string, unknown> };
  /**
   * 이번 턴에 새로 생성된 메시지(assistant의 tool_calls 포함 메시지, tool 결과, 최종 답변).
   * 서버가 세션을 저장하지 않으므로, 프론트엔드가 이 메시지들을 자신의 history 배열 뒤에 이어붙여
   * 다음 요청 때 그대로 다시 보내야 대화 맥락(예: 지금까지 채운 등록 필드)이 유지된다.
   */
  appendedMessages: ChatCompletionMessageParam[];
}

/**
 * 프론트엔드가 보관하는 전체 대화 이력(messages)을 받아 tool calling 루프를 한 번 돈다.
 * 서버는 세션 상태를 따로 저장하지 않는다 — 매 요청마다 클라이언트가 보내는 이력이 유일한 상태다.
 */
export async function runChatTurn(
  history: ChatCompletionMessageParam[],
  modeHint?: string,
): Promise<AgentTurnResult> {
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(modeHint ? [{ role: "system" as const, content: modeHint }] : []),
    ...history,
  ];
  const appendedMessages: ChatCompletionMessageParam[] = [];

  let card: AgentTurnResult["card"];

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 4096,
      messages,
      tools: TOOL_DEFINITIONS,
      tool_choice: "auto",
    });

    const message = response.choices[0]?.message;
    if (!message) throw new Error("에이전트 응답을 받지 못했습니다.");

    if (!message.tool_calls || message.tool_calls.length === 0) {
      appendedMessages.push(message);
      return { reply: message.content ?? "", card, appendedMessages };
    }

    messages.push(message);
    appendedMessages.push(message);

    for (const toolCall of message.tool_calls) {
      if (toolCall.type !== "function") continue;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(toolCall.function.arguments || "{}");
      } catch {
        args = {};
      }

      const { output, card: toolCard } = executeTool(toolCall.function.name, args);
      if (toolCard) card = toolCard;

      const toolMessage: ChatCompletionMessageParam = {
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(output),
      };
      messages.push(toolMessage);
      appendedMessages.push(toolMessage);
    }
  }

  return {
    reply: "요청을 처리하는 데 예상보다 많은 단계가 필요했습니다. 다시 한 번 말씀해 주시겠어요?",
    card,
    appendedMessages,
  };
}
