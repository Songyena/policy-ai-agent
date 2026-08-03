import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export interface RecordWithMeta<TFields> {
  id: string;
  revision: number;
  history: TFields[];
}

export type StoredRecord<TFields> = TFields & RecordWithMeta<TFields>;

/** StoredRecord에서 id/revision/history를 뺀 순수 필드만 남긴다(활동 로그 스냅샷 등에 사용). */
export function toFields<TFields extends Record<string, unknown>>(
  record: StoredRecord<TFields>,
): TFields {
  const { id: _id, revision: _revision, history: _history, ...fields } = record;
  return fields as unknown as TFields;
}

interface StoreShape<TFields> {
  version: 1;
  items: StoredRecord<TFields>[];
}

export interface RecordStoreOptions<TFields> {
  filePath: string;
  /** 중복 등록 판단 키. 같은 키를 가진 항목이 이미 있으면 create()가 기존 항목을 개정(revise)한다. */
  keyOf: (fields: TFields) => string;
  /** search()가 훑을 텍스트를 필드에서 뽑아낸다. */
  searchableText: (fields: TFields) => string;
}

/**
 * 정책/용어/이용약관 스토어가 공통으로 필요로 하는 "단일 JSON 파일 + 개정 이력" 로직을
 * 한 번만 구현하고 필드 타입(TFields)만 바꿔가며 재사용하기 위한 팩토리.
 * 세 스토어 모두 "생성 → 조회 → 중복이면 개정 → 삭제 → 검색"이라는 동일한 동작을 하므로
 * 파일을 3벌 복제하는 대신 이 팩토리 하나로 통일한다.
 */
export function createRecordStore<TFields extends Record<string, unknown>>(
  options: RecordStoreOptions<TFields>,
) {
  const { filePath, keyOf, searchableText } = options;
  let cache: StoreShape<TFields> | undefined;

  /**
   * 파일이 없으면(빈 볼륨을 새로 마운트한 첫 배포 등) 빈 상태로 새로 만든다.
   * 파일은 있지만 내용이 손상되어 JSON 파싱이 실패하는 경우(이전 프로세스가 쓰기 도중 죽은 경우
   * 등)나, 디렉터리 생성/쓰기 자체가 권한 문제로 실패하는 경우에도 크래시 대신 빈 상태(메모리에만
   * 존재, 지속은 안 됨)로 되돌린다 — 필드 하나 읽으려다 요청 전체(나아가 서버 전체)가 죽는 것보다는
   * 데이터를 잃더라도 서비스가 응답하는 편이 낫다.
   */
  function load(): StoreShape<TFields> {
    if (cache) return cache;
    try {
      mkdirSync(dirname(filePath), { recursive: true });
      if (!existsSync(filePath)) {
        cache = { version: 1, items: [] };
        writeFileSync(filePath, JSON.stringify(cache, null, 2), "utf-8");
        return cache;
      }
      cache = JSON.parse(readFileSync(filePath, "utf-8")) as StoreShape<TFields>;
      return cache;
    } catch (error) {
      console.error(`[recordStore] ${filePath} 초기화 실패 - 빈 상태로 계속 진행합니다.`, error);
      cache = { version: 1, items: [] };
      return cache;
    }
  }

  function persist(store: StoreShape<TFields>): void {
    cache = store;
    writeFileSync(filePath, JSON.stringify(store, null, 2), "utf-8");
  }

  function init(): void {
    load();
  }

  function getAll(): StoredRecord<TFields>[] {
    return [...load().items].sort((a, b) =>
      String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")),
    );
  }

  function getById(id: string): StoredRecord<TFields> | undefined {
    return load().items.find((item) => item.id === id);
  }

  function findByKey(fields: TFields): StoredRecord<TFields> | undefined {
    const key = keyOf(fields);
    return load().items.find((item) => keyOf(item) === key);
  }

  /** 신규 생성한다. 같은 키(keyOf)를 가진 기존 항목이 있으면 그 항목을 개정(revise)한다. */
  function create(fields: TFields): { record: StoredRecord<TFields>; wasRevision: boolean } {
    const existing = findByKey(fields);
    if (existing) {
      return { record: revise(existing.id, fields)!, wasRevision: true };
    }

    const store = load();
    const record: StoredRecord<TFields> = { ...fields, id: randomUUID(), revision: 1, history: [] };
    persist({ ...store, items: [...store.items, record] });
    return { record, wasRevision: false };
  }

  /** 기존 항목을 개정한다. 개정 전 필드 스냅샷을 history에 남기고 revision을 1 증가시킨다. */
  function revise(id: string, fields: TFields): StoredRecord<TFields> | undefined {
    const store = load();
    const target = store.items.find((item) => item.id === id);
    if (!target) return undefined;

    const { id: _id, revision, history, ...previousFields } = target;
    const previous = previousFields as unknown as TFields;
    const updated: StoredRecord<TFields> = {
      ...previous,
      ...fields,
      id: target.id,
      revision: revision + 1,
      history: [...history, previous],
    };

    persist({ ...store, items: store.items.map((item) => (item.id === id ? updated : item)) });
    return updated;
  }

  function remove(id: string): StoredRecord<TFields> | undefined {
    const store = load();
    const target = store.items.find((item) => item.id === id);
    if (!target) return undefined;
    persist({ ...store, items: store.items.filter((item) => item.id !== id) });
    return target;
  }

  /**
   * 공백으로 나눈 각 토큰이 searchableText에 얼마나 매칭되는지로 점수를 매겨 정렬한다.
   * 단순 전체 문자열 포함 검사(query 전체를 한 덩어리로 includes)는 사용자가 "채번규칙 정책"처럼
   * 원문에 그대로 붙어있지 않은 여러 단어로 물으면 0건이 되는 문제가 있어, 토큰 단위 OR 매칭 +
   * 매칭 토큰 수 기준 정렬로 완화한다.
   */
  function search(query: string): StoredRecord<TFields>[] {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return getAll();

    return getAll()
      .map((item) => {
        const haystack = searchableText(item).toLowerCase();
        const score = tokens.filter((token) => haystack.includes(token)).length;
        return { item, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);
  }

  return { init, getAll, getById, findByKey, create, revise, remove, search };
}
