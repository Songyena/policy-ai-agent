import { cookies } from "next/headers";
import type { User } from "../types/user";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./session";
import { getUserByUsername } from "./userStore";

/** Route Handler/Server Component에서 현재 로그인한 사용자를 조회한다. 없으면 null. */
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const username = verifySessionToken(token);
  if (!username) return null;
  return getUserByUsername(username) ?? null;
}
