import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/auth/currentUser";
import { registerPolicy, registerTerm, registerTermsConditions } from "@/db/index";
import { PolicyFieldsSchema } from "@/types/policy";
import { TermFieldsSchema } from "@/types/term";
import { TermsConditionsFieldsSchema } from "@/types/termsConditions";

/**
 * 대화형 폼 채우기의 확인 카드에서 사용자가 "등록"을 눌렀을 때 호출된다.
 * author/updatedAt은 사용자가 자기 신원을 자체 신고하는 값이 아니라 로그인 세션에서만 가져온다.
 */
const RequestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("policy"), fields: PolicyFieldsSchema.omit({ author: true, updatedAt: true }) }),
  z.object({ type: z.literal("term"), fields: TermFieldsSchema.omit({ author: true, updatedAt: true }) }),
  z.object({
    type: z.literal("termsConditions"),
    fields: TermsConditionsFieldsSchema.omit({ author: true, updatedAt: true }),
  }),
]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "필수 항목이 비어있거나 형식이 올바르지 않습니다.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const updatedAt = new Date().toISOString();
  const { type, fields } = parsed.data;

  try {
    if (type === "policy") {
      const result = registerPolicy({ ...fields, author: user.name, updatedAt }, user.name);
      return NextResponse.json(result);
    }
    if (type === "term") {
      const result = registerTerm({ ...fields, author: user.name, updatedAt }, user.name);
      return NextResponse.json(result);
    }
    const result = registerTermsConditions({ ...fields, author: user.name, updatedAt }, user.name);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: `등록 실패: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    );
  }
}
