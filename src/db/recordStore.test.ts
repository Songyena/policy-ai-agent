import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createRecordStore } from "./recordStore";

type Fields = {
  name: string;
  value: string;
  author: string;
  updatedAt: string;
};

function makeStore(dir: string) {
  return createRecordStore<Fields>({
    filePath: join(dir, "store.json"),
    keyOf: (f) => f.name.trim().toLowerCase(),
    searchableText: (f) => `${f.name} ${f.value}`,
  });
}

test("create() persists a new record with revision 1", () => {
  const dir = mkdtempSync(join(tmpdir(), "record-store-"));
  try {
    const store = makeStore(dir);
    const { record, wasRevision } = store.create({ name: "A", value: "1", author: "tester", updatedAt: "t0" });
    assert.equal(wasRevision, false);
    assert.equal(record.revision, 1);
    assert.equal(store.getAll().length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("create() with a duplicate key revises the existing record instead of creating a new one", () => {
  const dir = mkdtempSync(join(tmpdir(), "record-store-"));
  try {
    const store = makeStore(dir);
    const first = store.create({ name: "A", value: "1", author: "tester", updatedAt: "t0" });
    const second = store.create({ name: "A", value: "2", author: "tester2", updatedAt: "t1" });

    assert.equal(second.wasRevision, true);
    assert.equal(second.record.id, first.record.id);
    assert.equal(second.record.revision, 2);
    assert.equal(second.record.value, "2");
    assert.equal(second.record.history.length, 1);
    assert.equal(second.record.history[0]?.value, "1");
    assert.equal(store.getAll().length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("remove() deletes a record and returns it", () => {
  const dir = mkdtempSync(join(tmpdir(), "record-store-"));
  try {
    const store = makeStore(dir);
    const { record } = store.create({ name: "A", value: "1", author: "tester", updatedAt: "t0" });
    const removed = store.remove(record.id);
    assert.equal(removed?.id, record.id);
    assert.equal(store.getAll().length, 0);
    assert.equal(store.remove(record.id), undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("search() matches on searchableText and is case-insensitive", () => {
  const dir = mkdtempSync(join(tmpdir(), "record-store-"));
  try {
    const store = makeStore(dir);
    store.create({ name: "채번규칙", value: "CV2411120001", author: "tester", updatedAt: "t0" });
    store.create({ name: "환불정책", value: "결제 취소 시 환불", author: "tester", updatedAt: "t0" });

    assert.equal(store.search("CV24").length, 1);
    assert.equal(store.search("환불").length, 1);
    assert.equal(store.search("없는키워드").length, 0);
    assert.equal(store.search("").length, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
