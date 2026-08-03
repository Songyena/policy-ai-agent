import { NextResponse } from "next/server";
import { z } from "zod";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { getCurrentUser } from "@/auth/currentUser";
import { runChatTurn } from "@/agent/index";
import { initAllStores } from "@/db/index";
import { createSession, updateSessionMessages } from "@/db/chatSessionStore";

const RequestSchema = z.object({
  messages: z.array(z.record(z.string(), z.unknown())).min(1, "메시지가 필요합니다."),
  mode: z.string().optional(),
  sessionId: z.string().optional(),
});

const MODE_HINTS: Record<string, string> = {
  policy: "사용자가 /정책 명령을 사용했습니다. 정책 등록/조회 의도로 우선 해석하세요.",
  term: "사용자가 /용어 명령을 사용했습니다. 용어(표준 용어/유사어) 등록/조회 의도로 우선 해석하세요.",
  termsConditions: "사용자가 /약관 명령을 사용했습니다. 이용약관 항목 등록/조회 의도로 우선 해석하세요.",
};

function sessionTitleFrom(messages: Record<string, unknown>[]): string {
  const firstUserMessage = messages.find((m) => m.role === "user");
  const content = typeof firstUserMessage?.content === "string" ? firstUserMessage.content : "새 대화";
  return content.slice(0, 40);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const modeHint = parsed.data.mode ? MODE_HINTS[parsed.data.mode] : undefined;

  try {
    initAllStores();
    const result = await runChatTurn(
      parsed.data.messages as unknown as ChatCompletionMessageParam[],
      modeHint,
    );

    // 대화 세션 저장(24시간 보관) — 실패해도 채팅 응답 자체는 그대로 돌려준다(부가 기능이라
    // 이것 때문에 대화가 막히면 안 된다).
    let sessionId = parsed.data.sessionId;
    try {
      const user = await getCurrentUser();
      if (user) {
        const fullMessages = [...parsed.data.messages, ...result.appendedMessages] as Record<string, unknown>[];
        if (sessionId) {
          const updated = updateSessionMessages(sessionId, fullMessages);
          if (!updated) {
            // 세션이 만료됐거나 못 찾은 경우 새로 만든다.
            sessionId = createSession(user.id, sessionTitleFrom(parsed.data.messages), fullMessages).id;
          }
        } else {
          sessionId = createSession(user.id, sessionTitleFrom(parsed.data.messages), fullMessages).id;
        }
      }
    } catch (sessionError) {
      console.error("[api/chat] 대화 세션 저장 실패 - 무시하고 계속 진행합니다.", sessionError);
    }

    return NextResponse.json({ ...result, sessionId });
  } catch (error) {
    return NextResponse.json(
      { error: `응답 생성 실패: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    );
  }
}
