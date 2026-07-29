import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env";

export const SESSION_COOKIE_NAME = "policy_agent_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7일

interface SessionPayload {
  username: string;
  exp: number; // epoch ms
}

function sign(data: string): string {
  return createHmac("sha256", env.SESSION_SECRET).update(data).digest("hex");
}

/** 로그인/회원가입 성공 시, 쿠키에 담을 서명된 세션 토큰을 만든다. */
export function createSessionToken(username: string): string {
  const payload: SessionPayload = { username, exp: Date.now() + SESSION_DURATION_MS };
  const data = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  return `${data}.${sign(data)}`;
}

/** 쿠키에서 읽은 세션 토큰을 검증하고, 유효하면 username을 반환한다. */
export function verifySessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;

  const expected = sign(data);
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf-8")) as SessionPayload;
    if (typeof payload.username !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    return payload.username;
  } catch {
    return null;
  }
}
