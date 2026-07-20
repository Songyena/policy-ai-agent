# CLAUDE.md

이 문서는 **정책 싱크 및 영향도 분석 AI 에이전트** 프로젝트에서 작업할 때 따라야 할 규칙과 아키텍처를 정리한다.

## 1. 프로젝트 목표

엑셀(.xlsx) 정책 문서와 피그마(Figma) 화면설계서에 파편화되어 있는 서비스 정책을 하나의 지식창고로 통합하고,
1. 자연어 질문에 답하는 채팅형 인터페이스
2. 정책 변경 시 연관 항목을 추천하는 기초 영향도 분석

을 제공한다.

## 2. 아키텍처 원칙 — 3단계 데이터 파이프라인

데이터는 반드시 아래 3단계를 순서대로 거친다. 단계를 건너뛰거나 역할을 섞지 않는다.

```
[1] src/parser   Raw 추출        → data/raw/      (원본 엑셀(.xlsx), Figma 텍스트 추출본)
        │        엑셀·피그마를 그대로 파싱만 한다. 정제/판단 로직 없음.
        ▼
[2] src/refine   AI 정제/검수    → data/staging/  (AI가 만든 '정책 후보군' JSON)
        │        AI가 후보를 생성하고, 사용자가 승인(approve)하기 전까지는
        │        절대 최종 지식창고로 넘어가지 않는다.
        ▼
[3] src/db       지식창고 적재   → data/knowledge/ (JSON 파일, 승인된 정책만 존재)
                 채팅/영향도 분석은 오직 이 단계의 데이터만 근거로 답한다.
```

> `src/db`는 MVP 단계에서 네이티브 의존성 없는 단일 JSON 파일로 구현되어 있다.
> 데이터量이 커지거나 동시성이 필요해지면 `knowledgeStore.ts`의 함수 시그니처(`initDb`,
> `commitApprovedCandidate`, `getPolicyById`, `getAllPolicies`, `searchPolicies`,
> `findPoliciesByKeywords`)를 유지한 채 SQLite/Postgres 등으로 내부 구현만 교체하면 된다.

- **왜 이렇게 나누는가**: 엑셀과 피그마는 포맷·신뢰도가 다른 이종 데이터이고, AI가 잘못 정제한 내용이 검수 없이
  지식창고에 들어가면 이후 모든 답변의 신뢰도가 무너진다. "인풋 검수형" 구조가 MVP의 핵심 요구사항이므로,
  `refine` 단계의 승인 절차(`status: pending → approved`)를 생략하는 코드를 작성하지 않는다.
- `src/agent`(채팅/영향도 분석)는 `src/db`만 참조한다. `data/staging`이나 `data/raw`를 직접 읽지 않는다.

## 3. 폴더 구조

| 경로 | 역할 |
|---|---|
| `src/config/env.ts` | 환경변수 로드 및 zod 검증 |
| `src/types/policy.ts` | 파이프라인 전 단계에서 공유하는 타입 정의 |
| `src/parser/` | 엑셀(.xlsx)/Figma → `RawPolicySource` 파싱 (1단계) |
| `src/refine/` | `RawPolicySource` → AI 후보 생성, 검수 저장소 (2단계) |
| `src/db/` | 승인된 후보 → JSON 파일 적재, 조회 (3단계) |
| `src/agent/` | 채팅형 Q&A, 기초 영향도 분석 (Anthropic API 사용) |
| `src/app/` | Next.js App Router — 웹 대시보드(`page.tsx`)와 API 라우트(`api/parse`, `api/commit`) |
| `data/raw` | 업로드된 원본 파일 보관 |
| `data/staging` | 검수 대기/거절된 후보 (JSON) |
| `data/knowledge` | 최종 지식창고 JSON 파일 |

### 웹 UI (인풋 검수형 대시보드)

`src/app/page.tsx`는 클라이언트 컴포넌트로, 서버 전용 모듈(`config/env`, `db/*`, `refine/candidateGenerator` 등
Anthropic API 키를 다루는 코드)을 **절대 직접 import하지 않는다** — 반드시 `fetch("/api/parse")` /
`fetch("/api/commit")`를 통해서만 백엔드와 통신한다. API 라우트가 파이프라인의 2단계(refine)까지만
수행하고(`saveCandidates`로 staging에 저장), 검수 화면에서 남은 항목만 `/api/commit`을 통해 3단계(db)로
넘어간다. `/api/commit`은 요청에 포함되지 않은 기존 pending 후보를 자동으로 `rejected` 처리해
staging에 orphan 데이터가 쌓이지 않게 한다.

## 4. 개발 가이드라인

- **환경**: Node.js 20+, TypeScript, ESM (`"type": "module"`), Next.js(App Router) + Tailwind CSS.
  `tsconfig.json`은 Next.js 번들러 호환을 위해 `moduleResolution: "bundler"`를 사용한다 — 상대 경로 import에
  확장자를 붙이지 않는다. `@/*`는 `src/*`로의 경로 별칭이다.
- **환경변수**: 모든 외부 연동 키는 `.env`에 두고 `src/config/env.ts`를 통해서만 읽는다. `process.env`를
  다른 파일에서 직접 참조하지 않는다. 새 외부 연동(API)을 추가하면 `.env.example`과 `env.ts`의 zod 스키마를
  함께 갱신한다.
- **Anthropic API 사용**: 모델은 기본적으로 `claude-opus-4-8`을 사용한다(다른 모델을 명시적으로 요청받은 경우
  제외). 정책 후보 생성처럼 구조화된 출력이 필요한 곳에는 `client.beta.messages.parse` +
  `betaZodOutputFormat`(`@anthropic-ai/sdk/helpers/beta/zod`, zod v4 필요)을 사용하고, 프리필(assistant
  prefill)에 의존하지 않는다.
- **검수 없는 자동 커밋 금지**: `src/refine`에서 만든 후보를 사용자 승인 없이 `src/db`로 바로 적재하는
  코드를 추가하지 않는다.
- **비대칭적 확장 대비**: `src/parser`에 새로운 소스 타입(예: Notion, Confluence)을 추가할 때도
  최종적으로는 동일한 `RawPolicySource` 타입으로 정규화해서 `refine` 단계에 넘긴다.
- 불필요한 주석/추상화를 추가하지 않는다. 각 모듈은 자신의 단계 책임만 진다.

## 5. 실행

```bash
npm install
cp .env.example .env   # 키 채워넣기

# 웹 대시보드 (기본)
npm run dev             # Next.js 개발 서버
npm run build && npm start
npm run typecheck

# CLI (내부 도구 — AI 호출 없이 파이프라인 단계를 직접 조작할 때)
npm run cli -- ingest:excel <xlsx 파일 경로>
npm run cli -- commit
npm run cli -- chat "<질문>"
npm run review -- list|approve|reject [candidateId]
```
