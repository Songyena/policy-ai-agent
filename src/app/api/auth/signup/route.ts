import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/auth/session";
import { createUser } from "@/auth/userStore";
import { toPublicUser } from "@/types/user";

const RequestSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요."),
  username: z.string().min(3, "아이디는 3자 이상이어야 합니다."),
  password: z.string().min(4, "비밀번호는 4자 이상이어야 합니다."),
});

/** 이름/아이디/비밀번호로 회원가입하고, 바로 로그인 세션을 발급한다. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  try {
    const user = createUser(parsed.data.name, parsed.data.username, parsed.data.password);
    const token = createSessionToken(user.username);
    const response = NextResponse.json({ user: toPublicUser(user) });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
