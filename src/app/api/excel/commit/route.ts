import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/auth/currentUser";
import { registerPolicy, registerTerm, registerTermsConditions } from "@/db/index";
import { PolicyFieldsSchema } from "@/types/policy";
import { TermFieldsSchema } from "@/types/term";
import { TermsConditionsFieldsSchema } from "@/types/termsConditions";

const RequestSchema = z.object({
  sheets: z.array(
    z.object({
      type: z.enum(["policy", "term", "termsConditions"]),
      sheetName: z.string(),
      rows: z.array(
        z.object({
          rowIndex: z.number(),
          fields: z.record(z.string(), z.unknown()),
        }),
      ),
    }),
  ),
});

interface FailedRow {
  sheetName: string;
  rowIndex: number;
  errors: string[];
}

/**
 * 엑셀 업로드 2단계: 파싱 검증 모달에서 사용자가 확인(인라인 수정 포함)한 행들을 일괄 등록한다.
 * author/updatedAt이 시트에 없던 행은 업로드한 사용자/현재 시각으로 채운다 — 단, 시트에 원래
 * 작성자/작성일이 있던 행(과거 문서를 그대로 옮기는 경우)은 그 값을 그대로 존중한다.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const committed = { policy: 0, term: 0, termsConditions: 0 };
  const failed: FailedRow[] = [];

  for (const sheet of parsed.data.sheets) {
    for (const row of sheet.rows) {
      const withDefaults = {
        ...row.fields,
        author: row.fields.author || user.name,
        updatedAt: row.fields.updatedAt || now,
      };

      if (sheet.type === "policy") {
        const result = PolicyFieldsSchema.safeParse(withDefaults);
        if (!result.success) {
          failed.push({ sheetName: sheet.sheetName, rowIndex: row.rowIndex, errors: result.error.issues.map((i) => i.message) });
          continue;
        }
        registerPolicy(result.data, user.name);
        committed.policy += 1;
      } else if (sheet.type === "term") {
        const result = TermFieldsSchema.safeParse(withDefaults);
        if (!result.success) {
          failed.push({ sheetName: sheet.sheetName, rowIndex: row.rowIndex, errors: result.error.issues.map((i) => i.message) });
          continue;
        }
        registerTerm(result.data, user.name);
        committed.term += 1;
      } else {
        const result = TermsConditionsFieldsSchema.safeParse(withDefaults);
        if (!result.success) {
          failed.push({ sheetName: sheet.sheetName, rowIndex: row.rowIndex, errors: result.error.issues.map((i) => i.message) });
          continue;
        }
        registerTermsConditions(result.data, user.name);
        committed.termsConditions += 1;
      }
    }
  }

  return NextResponse.json({ committed, failed });
}
