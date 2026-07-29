import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { env } from "../config/env";
import type { ActivityLogEntry } from "../types/activity";

let cache: ActivityLogEntry[] | undefined;

function load(): ActivityLogEntry[] {
  if (cache) return cache;
  if (!existsSync(dirname(env.ACTIVITY_LOG_PATH))) {
    mkdirSync(dirname(env.ACTIVITY_LOG_PATH), { recursive: true });
  }
  if (!existsSync(env.ACTIVITY_LOG_PATH)) {
    cache = [];
    writeFileSync(env.ACTIVITY_LOG_PATH, "[]", "utf-8");
    return cache;
  }
  cache = JSON.parse(readFileSync(env.ACTIVITY_LOG_PATH, "utf-8")) as ActivityLogEntry[];
  return cache;
}

function persist(entries: ActivityLogEntry[]): void {
  cache = entries;
  writeFileSync(env.ACTIVITY_LOG_PATH, JSON.stringify(entries, null, 2), "utf-8");
}

/** 지식창고(정책/용어/이용약관)에 항목이 신규 등록/개정/삭제될 때마다 활동 로그 한 건을 남긴다. */
export function logActivity(entry: Omit<ActivityLogEntry, "id">): ActivityLogEntry {
  const full: ActivityLogEntry = { id: randomUUID(), ...entry };
  persist([...load(), full]);
  return full;
}

/** 최신순으로 정렬된 전체 활동 로그를 반환한다. */
export function getActivityLog(): ActivityLogEntry[] {
  return [...load()].sort((a, b) => b.at.localeCompare(a.at));
}
