import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { env } from "../config/env";
import type { PolicyCandidate } from "../types/policy";

const STAGING_FILE = join(env.STAGING_DATA_DIR, "candidates.json");

function ensureStagingFile(): void {
  if (!existsSync(dirname(STAGING_FILE))) {
    mkdirSync(dirname(STAGING_FILE), { recursive: true });
  }
  if (!existsSync(STAGING_FILE)) {
    writeFileSync(STAGING_FILE, "[]", "utf-8");
  }
}

function readAll(): PolicyCandidate[] {
  ensureStagingFile();
  return JSON.parse(readFileSync(STAGING_FILE, "utf-8")) as PolicyCandidate[];
}

function writeAll(candidates: PolicyCandidate[]): void {
  ensureStagingFile();
  writeFileSync(STAGING_FILE, JSON.stringify(candidates, null, 2), "utf-8");
}

/** candidateGenerator가 만든 신규 후보를 검수 대기(pending) 상태로 저장한다. */
export function saveCandidates(candidates: PolicyCandidate[]): void {
  const existing = readAll();
  writeAll([...existing, ...candidates]);
}

export function listByStatus(status: PolicyCandidate["status"]): PolicyCandidate[] {
  return readAll().filter((c) => c.status === status);
}

export function listPending(): PolicyCandidate[] {
  return listByStatus("pending");
}

/** 사용자가 후보를 승인한다. 승인된 항목만 db 단계로 넘어갈 수 있다. */
export function approveCandidate(id: string): PolicyCandidate {
  const all = readAll();
  const target = all.find((c) => c.id === id);
  if (!target) throw new Error(`후보를 찾을 수 없습니다: ${id}`);
  target.status = "approved";
  writeAll(all);
  return target;
}

/** 검수 화면에서 사용자가 후보의 내용을 직접 수정할 때 사용한다. status는 여기서 바꾸지 않는다. */
export function updateCandidate(
  id: string,
  patch: Partial<Pick<PolicyCandidate, "title" | "description" | "category" | "keywords">>,
): PolicyCandidate {
  const all = readAll();
  const target = all.find((c) => c.id === id);
  if (!target) throw new Error(`후보를 찾을 수 없습니다: ${id}`);
  Object.assign(target, patch);
  writeAll(all);
  return target;
}

export function rejectCandidate(id: string): PolicyCandidate {
  const all = readAll();
  const target = all.find((c) => c.id === id);
  if (!target) throw new Error(`후보를 찾을 수 없습니다: ${id}`);
  target.status = "rejected";
  writeAll(all);
  return target;
}

/** db 단계 커밋 후, 이미 적재된 approved 후보를 스테이징에서 정리할 때 사용한다. */
export function removeCandidates(ids: string[]): void {
  const remaining = readAll().filter((c) => !ids.includes(c.id));
  writeAll(remaining);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [command, arg] = process.argv.slice(2);
  switch (command) {
    case "list":
      console.log(JSON.stringify(listPending(), null, 2));
      break;
    case "approve":
      if (!arg) throw new Error("사용법: npm run review -- approve <candidateId>");
      console.log(JSON.stringify(approveCandidate(arg), null, 2));
      break;
    case "reject":
      if (!arg) throw new Error("사용법: npm run review -- reject <candidateId>");
      console.log(JSON.stringify(rejectCandidate(arg), null, 2));
      break;
    default:
      console.error("사용법: npm run review -- <list|approve|reject> [candidateId]");
      process.exit(1);
  }
}
