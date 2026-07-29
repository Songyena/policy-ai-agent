import { NextResponse } from "next/server";
import { z } from "zod";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { runChatTurn } from "@/agent/index";
import { initAllStores } from "@/db/index";

const RequestSchema = z.object({
  messages: z.array(z.record(z.string(), z.unknown())).min(1, "메시지가 필요합니다."),
  mode: z.string().optional(),
});

const MODE_HINTS: Record<string, string> = {
  policy: "사용자가 /정책 명령을 사용했습니다. 정책 등록/조회 의도로 우선 해석하세요.",
  term: "사용자가 /용어 명령을 사용했습니다. 용어(표준 용어/유사어) 등록/조회 의도로 우선 해석하세요.",
  termsConditions: "사용자가 /약관 명령을 사용했습니다. 이용약관 항목 등록/조회 의도로 우선 해석하세요.",
};

export async function POST(request: Request) {
  initAllStores();
  const body = await request.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const modeHint = parsed.data.mode ? MODE_HINTS[parsed.data.mode] : undefined;

  try {
    const result = await runChatTurn(
      parsed.data.messages as unknown as ChatCompletionMessageParam[],
      modeHint,
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: `응답 생성 실패: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    );
  }
}
