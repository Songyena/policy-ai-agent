import { NextResponse, type NextRequest } from "next/server";

// src/auth/session.ts의 SESSION_COOKIE_NAME과 반드시 같은 값을 유지해야 한다.
// 미들웨어는 Edge 런타임에서 실행되어 node:crypto를 쓰는 session.ts를 그대로 import할 수 없으므로,
// 여기서는 쿠키 존재 여부만 가볍게 확인해 리다이렉트하고, 실제 서명 검증은
// (app)/layout.tsx와 각 API 라우트의 getCurrentUser()에서 수행한다.
const SESSION_COOKIE_NAME = "policy_agent_session";

const PUBLIC_PAGE_PATHS = new Set(["/login", "/signup"]);
const PUBLIC_API_PREFIX = "/api/auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PAGE_PATHS.has(pathname) || pathname.startsWith(PUBLIC_API_PREFIX)) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (pathname.startsWith("/api/")) {
    if (!hasSession) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
