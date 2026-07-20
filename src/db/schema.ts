import type { PolicyRecord } from "../types/policy";

/**
 * 3단계(db) 저장 포맷. MVP에서는 별도 서버/네이티브 의존성 없이 동작하도록
 * 단일 JSON 파일로 저장한다. approved 상태의 정책만 여기에 들어온다.
 *
 * 데이터가 커지거나 동시 접근이 필요해지면 이 파일의 인터페이스(아래 knowledgeStore.ts의
 * 함수 시그니처)를 그대로 유지한 채 SQLite/Postgres 등으로 교체할 수 있다.
 */
export interface KnowledgeStoreShape {
  version: 1;
  policies: PolicyRecord[];
}

export function emptyStore(): KnowledgeStoreShape {
  return { version: 1, policies: [] };
}
