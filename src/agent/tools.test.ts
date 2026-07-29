import assert from "node:assert/strict";
import { test } from "node:test";
import { executeTool } from "./tools";

test("draft_policy reports missing required fields and no card until complete", () => {
  const partial = executeTool("draft_policy", { category: "채번규칙", policyName: "관리번호" });
  const partialOutput = partial.output as { status: string; missingFields: string[] };
  assert.equal(partialOutput.status, "incomplete");
  assert.ok(partialOutput.missingFields.includes("설명1(규칙/포맷)"));
  assert.ok(partialOutput.missingFields.includes("예시"));
  assert.equal(partial.card, undefined);

  const complete = executeTool("draft_policy", {
    category: "채번규칙",
    policyName: "관리번호",
    ruleDesc: "CV+YYMMDD+4자리",
    example: "CV2411120001",
  });
  const completeOutput = complete.output as { status: string; missingFields: string[] };
  assert.equal(completeOutput.status, "ready");
  assert.deepEqual(completeOutput.missingFields, []);
  assert.equal(complete.card?.type, "policy");
});

test("draft_term treats an empty synonyms array as complete (not required)", () => {
  const result = executeTool("draft_term", {
    standardTerm: "신용등급",
    uiMenu: "마이페이지",
    definition: "개인의 신용도를 나타내는 등급",
  });
  const output = result.output as { status: string; missingFields: string[] };
  assert.equal(output.status, "ready");
  assert.equal(result.card?.type, "term");
});

test("draft_terms_conditions requires all of useStatus/requiredStatus/deviceCategory/termsName/manageCode/revisionDate", () => {
  const result = executeTool("draft_terms_conditions", { termsName: "이용약관" });
  const output = result.output as { status: string; missingFields: string[] };
  assert.equal(output.status, "incomplete");
  assert.equal(output.missingFields.length, 5);
  assert.equal(result.card, undefined);
});

test("executeTool throws on unknown tool names", () => {
  assert.throws(() => executeTool("does_not_exist", {}));
});
