import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { env } from "../config/env";
import type { User } from "../types/user";

function ensureUsersFile(): void {
  if (!existsSync(dirname(env.USERS_DATA_PATH))) {
    mkdirSync(dirname(env.USERS_DATA_PATH), { recursive: true });
  }
  if (!existsSync(env.USERS_DATA_PATH)) {
    writeFileSync(env.USERS_DATA_PATH, "[]", "utf-8");
  }
}

function readAll(): User[] {
  ensureUsersFile();
  return JSON.parse(readFileSync(env.USERS_DATA_PATH, "utf-8")) as User[];
}

function writeAll(users: User[]): void {
  ensureUsersFile();
  writeFileSync(env.USERS_DATA_PATH, JSON.stringify(users, null, 2), "utf-8");
}

function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

function passwordMatches(password: string, hash: string, salt: string): boolean {
  const candidate = scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, "hex");
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

export function getUserByUsername(username: string): User | undefined {
  return readAll().find((u) => u.username === username);
}

/** 이름/아이디/비밀번호로 새 사용자를 등록한다. 아이디가 이미 있으면 에러를 던진다. */
export function createUser(name: string, username: string, password: string): User {
  const all = readAll();
  if (all.some((u) => u.username === username)) {
    throw new Error("이미 사용 중인 아이디입니다.");
  }
  const { hash, salt } = hashPassword(password);
  const user: User = {
    id: randomUUID(),
    username,
    name,
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: new Date().toISOString(),
  };
  writeAll([...all, user]);
  return user;
}

/** 아이디/비밀번호를 검증한다. 일치하지 않으면 null을 반환한다. */
export function verifyUser(username: string, password: string): User | null {
  const user = getUserByUsername(username);
  if (!user) return null;
  return passwordMatches(password, user.passwordHash, user.passwordSalt) ? user : null;
}
