import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { env } from "../config/env";
import type { ActivityLogEntry } from "../types/activity";

let cache: ActivityLogEntry[] | undefined;

function load(): ActivityLogEntry[] {
  if (cache) return cache;
  try {
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
  } catch (error) {
    console.error(`[activityLog] ${env.ACTIVITY_LOG_PATH} 초기화 실패 - 빈 상태로 계속 진행합니다.`, error);
    cache = [];
    return cache;
  }
}

/** 서버 시작 시점에 미리 파일/디렉터리를 준비해두기 위한 진입점(instrumentation.ts에서 호출). */
export function initActivityLog(): void {
  load();
}

function persist(entries: ActivityLogEntry[]): void {
  cache = entries;
  writeFileSync(env.ACTIVITY_LOG_PATH, JSON.stringify(entries, null, 2), "utf-8");
}

/**
 * 지식창고(정책/용어/이용약관)에 항목이 신규 등록/개정/삭제될 때마다 활동 로그 한 건을 남긴다.
 * 이 로그는 감사(audit) 목적의 부가 기능일 뿐이라, 여기서 쓰기가 실패한다고 이미 성공적으로
 * 저장된 정책/용어/약관 등록 자체가 실패한 것처럼 응답되어서는 안 된다 — 실패해도 로그만
 * 남기고 계속 진행한다.
 */
export function logActivity(entry: Omit<ActivityLogEntry, "id">): ActivityLogEntry {
  const full: ActivityLogEntry = { id: randomUUID(), ...entry };
  try {
    persist([...load(), full]);
  } catch (error) {
    console.error("[activityLog] 활동 로그 기록 실패 - 무시하고 계속 진행합니다.", error);
  }
  return full;
}

/** 최신순으로 정렬된 전체 활동 로그를 반환한다. */
export function getActivityLog(): ActivityLogEntry[] {
  return [...load()].sort((a, b) => b.at.localeCompare(a.at));
}
