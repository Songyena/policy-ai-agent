import { existsSync, readdirSync, unlinkSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { env } from "../config/env";
import { createRecordStore, type StoredRecord } from "./recordStore";
import type { ChatSessionFields } from "../types/chatSession";

export type ChatSessionRecord = StoredRecord<ChatSessionFields>;

const SHARD_FILENAME_RE = /^sessions-(\d{4}-\d{2}-\d{2})\.json$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function dateKeyOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shardPath(dateKey: string): string {
  return join(env.CHATS_DATA_DIR, `sessions-${dateKey}.json`);
}

type Shard = ReturnType<typeof createRecordStore<ChatSessionFields>>;
const shardCache = new Map<string, Shard>();

/**
 * 채팅 세션도 정책/용어/약관과 같은 recordStore 팩토리를 그대로 쓰되, 날짜별로 파일을 나눈다
 * (`data/chats/sessions-YYYY-MM-DD.json`) — recordStore는 쓸 때마다 파일 전체를 다시
 * 직렬화하므로, 모든 사용자의 모든 세션을 한 파일에 몰아넣으면 메시지 하나 추가할 때마다
 * 전체 대화 데이터를 다시 쓰게 된다. 날짜로 나누면 그 날 분량만 다시 쓰면 되고, 보관기간(24시간)이
 * 지난 날짜의 파일은 통째로 지울 수 있어 정리도 쉬워진다.
 */
function shardFor(dateKey: string): Shard {
  let shard = shardCache.get(dateKey);
  if (!shard) {
    shard = createRecordStore<ChatSessionFields>({
      filePath: shardPath(dateKey),
      // 채팅 세션은 정책/용어/약관과 달리 "같은 내용이면 개정"할 자연적인 키가 없다 — 매번
      // 새 세션이어야 하므로, 생성 시 발급하는 난수를 키로 써서 항상 새 레코드로 만들어진다.
      keyOf: (fields) => fields.nonce,
      searchableText: (fields) => fields.title,
    });
    shardCache.set(dateKey, shard);
  }
  return shard;
}

function retentionMs(): number {
  return env.CHAT_RETENTION_HOURS * 60 * 60 * 1000;
}

function isExpired(session: ChatSessionRecord, now: number): boolean {
  return now - new Date(session.createdAt).getTime() > retentionMs();
}

/** 세션이 있을 수 있는 날짜 shard 후보. 보관기간이 며칠이든 안전하게 커버한다. */
function recentDateKeys(now = new Date()): string[] {
  const spanDays = Math.ceil(retentionMs() / DAY_MS) + 1;
  const keys: string[] = [];
  for (let i = 0; i < spanDays; i++) {
    keys.push(dateKeyOf(new Date(now.getTime() - i * DAY_MS)));
  }
  return keys;
}

function allShardDateKeysOnDisk(): string[] {
  if (!existsSync(env.CHATS_DATA_DIR)) return [];
  return readdirSync(env.CHATS_DATA_DIR)
    .map((name) => name.match(SHARD_FILENAME_RE)?.[1])
    .filter((key): key is string => Boolean(key));
}

/** 새 대화 세션을 만든다(오늘 날짜 shard에 저장). 쓰기 시점에 만료된 세션도 함께 정리한다. */
export function createSession(
  userId: string,
  title: string,
  messages: Record<string, unknown>[],
): ChatSessionRecord {
  cleanupExpiredSessions();
  const now = new Date().toISOString();
  const { record } = shardFor(dateKeyOf(new Date())).create({
    nonce: randomUUID(),
    userId,
    title,
    messages,
    createdAt: now,
    updatedAt: now,
  });
  return record;
}

/** sessionId로 세션을 찾는다. 만료된 세션은 없는 것으로 취급한다. */
export function findSession(sessionId: string): ChatSessionRecord | undefined {
  const now = Date.now();
  for (const dateKey of recentDateKeys()) {
    const record = shardFor(dateKey).getById(sessionId);
    if (record) return isExpired(record, now) ? undefined : record;
  }
  return undefined;
}

/**
 * 기존 세션의 메시지 전체를 교체한다(델타 append가 아니라 덮어쓰기) — 프론트가 매 요청마다
 * 전체 대화 이력을 보내는 무상태 구조와 맞추기 위함이다. 만료된 세션은 갱신하지 않는다.
 */
export function updateSessionMessages(
  sessionId: string,
  messages: Record<string, unknown>[],
): ChatSessionRecord | undefined {
  cleanupExpiredSessions();
  const now = Date.now();
  for (const dateKey of recentDateKeys()) {
    const shard = shardFor(dateKey);
    const existing = shard.getById(sessionId);
    if (!existing) continue;
    if (isExpired(existing, now)) return undefined;
    const { id: _id, revision: _revision, history: _history, ...fields } = existing;
    return shard.revise(sessionId, { ...fields, messages, updatedAt: new Date().toISOString() });
  }
  return undefined;
}

/** 세션을 삭제한다. 본인 소유가 아니거나 이미 없는(만료 포함) 세션이면 false를 반환한다. */
export function deleteSession(sessionId: string, userId: string): boolean {
  const now = Date.now();
  for (const dateKey of recentDateKeys()) {
    const shard = shardFor(dateKey);
    const existing = shard.getById(sessionId);
    if (!existing) continue;
    if (existing.userId !== userId || isExpired(existing, now)) return false;
    shard.remove(sessionId);
    return true;
  }
  return false;
}

/** 특정 사용자의(만료되지 않은) 세션을 최근 순으로 반환한다. */
export function listSessionsForUser(userId: string): ChatSessionRecord[] {
  const now = Date.now();
  const results: ChatSessionRecord[] = [];
  for (const dateKey of recentDateKeys()) {
    for (const record of shardFor(dateKey).getAll()) {
      if (record.userId === userId && !isExpired(record, now)) results.push(record);
    }
  }
  return results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * 보관기간이 지난 세션을 실제 파일에서도 제거한다 — 조회 시 필터링(isExpired)만으로는 볼륨에
 * 계속 쌓이기만 하므로, 쓰기 시점(lazy)과 주기적 타이머(instrumentation.ts) 양쪽에서 호출한다.
 * 최근 날짜 shard는 만료분만 걸러 다시 쓰고, 그보다 오래된(=전부 만료가 확실한) shard 파일은
 * 통째로 지운다.
 */
export function cleanupExpiredSessions(): void {
  const now = Date.now();

  for (const dateKey of recentDateKeys(new Date())) {
    const shard = shardFor(dateKey);
    for (const session of shard.getAll()) {
      if (isExpired(session, now)) shard.remove(session.id);
    }
  }

  const safeKeys = new Set(recentDateKeys(new Date()));
  for (const dateKey of allShardDateKeysOnDisk()) {
    if (safeKeys.has(dateKey)) continue;
    // recentDateKeys 범위 밖 = 그 날짜에 생성됐을 세션은 전부 보관기간을 넘겼다고 볼 수 있다.
    try {
      unlinkSync(shardPath(dateKey));
      shardCache.delete(dateKey);
    } catch (error) {
      console.error(`[chatSessionStore] ${shardPath(dateKey)} 삭제 실패`, error);
    }
  }
}

let cleanupIntervalStarted = false;

/** 프로세스가 떠 있는 동안 주기적으로 만료 세션을 정리한다. 서버 시작 시 한 번만 호출한다. */
export function startPeriodicCleanup(intervalHours = 1): void {
  if (cleanupIntervalStarted) return;
  cleanupIntervalStarted = true;
  setInterval(() => {
    try {
      cleanupExpiredSessions();
    } catch (error) {
      console.error("[chatSessionStore] 주기적 정리 실패", error);
    }
  }, intervalHours * 60 * 60 * 1000).unref();
}
