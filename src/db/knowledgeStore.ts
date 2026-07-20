import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { env } from "../config/env";
import type { PolicyCandidate, PolicyRecord } from "../types/policy";
import { emptyStore, type KnowledgeStoreShape } from "./schema";

let cache: KnowledgeStoreShape | undefined;

function load(): KnowledgeStoreShape {
  if (cache) return cache;
  mkdirSync(dirname(env.DATABASE_PATH), { recursive: true });
  if (!existsSync(env.DATABASE_PATH)) {
    cache = emptyStore();
    writeFileSync(env.DATABASE_PATH, JSON.stringify(cache, null, 2), "utf-8");
    return cache;
  }
  cache = JSON.parse(readFileSync(env.DATABASE_PATH, "utf-8")) as KnowledgeStoreShape;
  return cache;
}

function persist(store: KnowledgeStoreShape): void {
  cache = store;
  writeFileSync(env.DATABASE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

/** 지식창고 파일을 초기화(없으면 생성)한다. 앱 진입점에서 한 번만 호출하면 된다. */
export function initDb(): KnowledgeStoreShape {
  return load();
}

/**
 * 승인(approved)된 정책 후보만 지식창고에 적재한다.
 * refine 단계의 검수를 우회하는 경로를 만들지 않기 위해 status를 여기서도 검증한다.
 */
export function commitApprovedCandidate(candidate: PolicyCandidate): PolicyRecord {
  if (candidate.status !== "approved") {
    throw new Error(
      `승인되지 않은 후보는 지식창고에 적재할 수 없습니다 (id=${candidate.id}, status=${candidate.status})`,
    );
  }

  const store = load();
  const record: PolicyRecord = {
    id: candidate.id,
    title: candidate.title,
    description: candidate.description,
    category: candidate.category,
    keywords: candidate.keywords,
    sourceIds: candidate.sourceIds,
    confirmedAt: new Date().toISOString(),
  };

  persist({ ...store, policies: [...store.policies, record] });
  return record;
}

export function getPolicyById(id: string): PolicyRecord | undefined {
  return load().policies.find((p) => p.id === id);
}

export function getAllPolicies(): PolicyRecord[] {
  return [...load().policies].sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt));
}

/** 채팅형 지식창고가 질문에 답할 때 관련 정책을 찾기 위해 사용하는 단순 키워드/제목 검색. */
export function searchPolicies(query: string): PolicyRecord[] {
  const needle = query.toLowerCase();
  return load().policies.filter(
    (p) =>
      p.title.toLowerCase().includes(needle) ||
      p.description.toLowerCase().includes(needle) ||
      p.keywords.some((k) => k.toLowerCase().includes(needle)),
  );
}

/** 기초 영향도 분석: 주어진 키워드와 겹치는 다른 정책을 찾는다. */
export function findPoliciesByKeywords(keywords: string[], excludeId?: string): PolicyRecord[] {
  if (keywords.length === 0) return [];
  const keywordSet = new Set(keywords.map((k) => k.toLowerCase()));
  return load().policies.filter(
    (p) =>
      p.id !== excludeId && p.keywords.some((k) => keywordSet.has(k.toLowerCase())),
  );
}
