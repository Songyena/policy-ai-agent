import { analyzeImpact, askPolicyQuestion } from "./agent/index";
import { commitApprovedCandidate, initDb } from "./db/index";
import { parseExcelFile, parseFigmaTextExport } from "./parser/index";
import {
  generateCandidates,
  listByStatus,
  removeCandidates,
  saveCandidates,
} from "./refine/index";

/**
 * 정책 싱크 및 영향도 분석 에이전트 CLI.
 *
 *   npm run cli -- ingest:excel <파일 경로>   1단계+2단계: 엑셀(.xlsx) 파싱 → AI 후보 생성 → staging 저장
 *   npm run cli -- ingest:figma <파일 경로>   1단계+2단계: Figma 텍스트 파싱 → AI 후보 생성 → staging 저장
 *   npm run cli -- commit                     승인(approved)된 후보를 지식창고에 적재
 *   npm run cli -- chat "<질문>"              채팅형 지식창고 질의
 *   npm run cli -- impact <policyId>          기초 영향도 분석
 *
 * 후보 검수(승인/거절)는 `npm run review -- list|approve|reject`로 별도 수행한다.
 */
async function main() {
  const [command, ...rest] = process.argv.slice(2);
  initDb();

  switch (command) {
    case "ingest:excel": {
      const filePath = rest[0];
      if (!filePath) throw new Error("사용법: ingest:excel <xlsx 파일 경로>");
      const sources = parseExcelFile(filePath);
      const candidates = await generateCandidates(sources);
      saveCandidates(candidates);
      console.log(`${candidates.length}개의 정책 후보를 생성했습니다 (검수 대기).`);
      break;
    }

    case "ingest:figma": {
      const filePath = rest[0];
      if (!filePath) throw new Error("사용법: ingest:figma <내보낸 텍스트 파일 경로>");
      const sources = parseFigmaTextExport(filePath);
      const candidates = await generateCandidates(sources);
      saveCandidates(candidates);
      console.log(`${candidates.length}개의 정책 후보를 생성했습니다 (검수 대기).`);
      break;
    }

    case "commit": {
      const approved = listByStatus("approved");
      if (approved.length === 0) {
        console.log("승인된 후보가 없습니다. `npm run review -- list`로 먼저 검수하세요.");
        break;
      }
      const committed = approved.map(commitApprovedCandidate);
      removeCandidates(committed.map((c) => c.id));
      console.log(`${committed.length}개의 정책을 지식창고에 적재했습니다.`);
      break;
    }

    case "chat": {
      const question = rest.join(" ");
      if (!question) throw new Error('사용법: chat "<질문>"');
      console.log(await askPolicyQuestion(question));
      break;
    }

    case "impact": {
      const policyId = rest[0];
      if (!policyId) throw new Error("사용법: impact <policyId>");
      const result = await analyzeImpact(policyId);
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    default:
      console.log(
        [
          "사용법:",
          "  npm run cli -- ingest:excel <xlsx 파일 경로>",
          "  npm run cli -- ingest:figma <내보낸 텍스트 파일 경로>",
          "  npm run review -- list|approve|reject [candidateId]",
          "  npm run cli -- commit",
          '  npm run cli -- chat "<질문>"',
          "  npm run cli -- impact <policyId>",
        ].join("\n"),
      );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
