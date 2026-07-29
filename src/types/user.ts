import { z } from "zod";

export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string(),
  passwordHash: z.string(),
  passwordSalt: z.string(),
  createdAt: z.string(),
});
export type User = z.infer<typeof UserSchema>;

/** 비밀번호 해시/솔트를 제외하고 클라이언트로 내려줘도 되는 사용자 정보. */
export type PublicUser = Omit<User, "passwordHash" | "passwordSalt">;

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, passwordSalt: _passwordSalt, ...publicUser } = user;
  return publicUser;
}
