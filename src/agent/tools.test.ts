import assert from "node:assert/strict";
import { test } from "node:test";
import { executeTool } from "./tools";

test("draft_policy only requires policyName; other fields are optional", () => {
  const partial = executeTool("draft_policy", { category: "채번규칙" });
  const partialOutput = partial.output as { status: string; missingFields: string[] };
  assert.equal(partialOutput.status, "incomplete");
  assert.deepEqual(partialOutput.missingFields, ["정책명"]);
  assert.equal(partial.card, undefined);

  const complete = executeTool("draft_policy", { policyName: "관리번호 채번규칙" });
  const completeOutput = complete.output as { status: string; missingFields: string[] };
  assert.equal(completeOutput.status, "ready");
  assert.deepEqual(completeOutput.missingFields, []);
  assert.equal(complete.card?.type, "policy");
});

test("draft_term only requires standardTerm; empty synonyms array is fine", () => {
  const result = executeTool("draft_term", { standardTerm: "신용등급" });
  const output = result.output as { status: string; missingFields: string[] };
  assert.equal(output.status, "ready");
  assert.equal(result.card?.type, "term");
});

test("draft_terms_conditions only requires termsName", () => {
  const incomplete = executeTool("draft_terms_conditions", { deviceCategory: "공통" });
  const incompleteOutput = incomplete.output as { status: string; missingFields: string[] };
  assert.equal(incompleteOutput.status, "incomplete");
  assert.deepEqual(incompleteOutput.missingFields, ["약관명"]);
  assert.equal(incomplete.card, undefined);

  const complete = executeTool("draft_terms_conditions", { termsName: "이용약관" });
  const completeOutput = complete.output as { status: string; missingFields: string[] };
  assert.equal(completeOutput.status, "ready");
  assert.equal(complete.card?.type, "termsConditions");
});

test("executeTool throws on unknown tool names", () => {
  assert.throws(() => executeTool("does_not_exist", {}));
});
