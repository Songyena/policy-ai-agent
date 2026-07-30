import { cookies } from "next/headers";
import type { User } from "../types/user";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./session";
import { getUserByUsername } from "./userStore";

/**
 * Route Handler/Server Component에서 현재 로그인한 사용자를 조회한다. 없으면 null.
 * 이 함수는 거의 모든 요청(페이지 렌더링 + 대부분의 API 라우트)에서 호출되므로, 내부에서
 * 어떤 이유로든(계정 저장소 파일 접근 실패 등) 예외가 나면 그 예외가 그대로 요청 전체를
 * 실패시키지 않도록 여기서 잡아 로그를 남기고 "로그인 안 됨"으로 안전하게 처리한다.
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const username = verifySessionToken(token);
    if (!username) return null;
    return getUserByUsername(username) ?? null;
  } catch (error) {
    console.error("[getCurrentUser] 세션/계정 조회 실패 - 비로그인 상태로 처리합니다.", error);
    return null;
  }
}
