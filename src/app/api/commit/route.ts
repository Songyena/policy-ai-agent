import { NextResponse } from "next/server";
import { z } from "zod";
import { commitApprovedCandidate, initDb } from "@/db/index";
import {
  approveCandidate,
  listPending,
  rejectCandidate,
  removeCandidates,
  updateCandidate,
} from "@/refine/index";

const CommitRequestSchema = z.object({
  candidates: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      category: z.string(),
      keywords: z.array(z.string()),
    }),
  ),
});

/**
 * 검수 테이블에서 남긴(수정 포함) 후보들을 최종 승인하여 지식창고에 적재한다.
 * 검수 대기 중이었지만 이번 요청에 포함되지 않은(=화면에서 삭제한) 후보는 거절 처리한다.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = CommitRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const { candidates } = parsed.data;
  initDb();

  const keptIds = new Set(candidates.map((c) => c.id));
  const pending = listPending();

  // 화면에서 삭제된(=이번 요청에 포함되지 않은) 대기 중 후보는 거절 처리한다.
  for (const candidate of pending) {
    if (!keptIds.has(candidate.id)) {
      rejectCandidate(candidate.id);
    }
  }

  const committed = candidates.map((candidate) => {
    updateCandidate(candidate.id, {
      title: candidate.title,
      description: candidate.description,
      category: candidate.category,
      keywords: candidate.keywords,
    });
    const approved = approveCandidate(candidate.id);
    return commitApprovedCandidate(approved);
  });

  removeCandidates(candidates.map((c) => c.id));

  return NextResponse.json({ committed });
}
