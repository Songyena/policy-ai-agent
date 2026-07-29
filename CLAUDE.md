# CLAUDE.md

이 문서는 **단일 대화창 기반 사내 정책 통합 관리 AI 에이전트** 프로젝트에서 작업할 때 따라야 할
규칙과 아키텍처를 정리한다.

## 1. 프로젝트 목표

정책(Policies) / 표준 용어집(Glossary) / 이용약관(Terms & Conditions)이라는 서로 다른 3종
데이터를, 메뉴 이동 없는 **하나의 대화창**에서

1. 자연어로 조회(RAG 검색)
2. 대화로 필수 항목을 채워가는 등록(대화형 폼 채우기)
3. 엑셀(.xlsx) 업로드를 통한 다중 시트 자동 인식 + 검증 + 일괄 등록

으로 통합 관리한다. (이전 버전은 대분류/세부분류 + 동적 `fields` 배열로 정책만 다루는
멀티 페이지 대시보드였다 — 이 버전에서 정책/용어/약관 3종 고정 스키마 + 단일 채팅 UI로
전면 재구성했다.)

## 2. 아키텍처 원칙

### 데이터: 3개의 독립된 고정 스키마 지식창고

`src/types/{policy,term,termsConditions}.ts`에 zod로 정의된 고정 필드만 쓴다 — 대분류별로
필드 구성이 달라지는 동적 구조(`fields: {key,value}[]`)는 쓰지 않는다. 각 스키마는
`data/knowledge/{policies,terms,terms_conditions}.json`이라는 독립된 파일에 저장되며,
`src/db/recordStore.ts`의 공통 팩토리(`createRecordStore`)로 "생성 → 중복이면 개정 →
삭제 → 검색"을 구현한다. 세 스토어(`policyStore`/`termStore`/`termsConditionsStore`)는
파일 경로/중복 판단 키(`keyOf`)/검색 대상 텍스트만 다르게 주입한 것이다.

- 정책의 중복 키: 정책명+세부항목 (구분은 선택 항목이라 키에서 뺐다 — 넣으면 같은 정책이
  구분 표기 차이로 중복 저장될 수 있다)
- 용어의 중복 키: 표준 용어
- 이용약관의 중복 키: 관리코드가 있으면 관리코드, 없으면(선택 항목) 약관명+기기구분으로 대체

같은 키로 다시 등록하면 신규가 아니라 **개정**(revision +1, 이전 필드는 `history`에 스냅샷)으로
처리된다. `author`/`updatedAt` 필드가 곧 "작성/수정자"·"작성/수정일"이므로 별도의
createdBy/createdAt을 두지 않는다.

**필수 필드는 이름 필드 하나뿐이다**: 정책은 정책명, 용어는 표준 용어, 이용약관은 약관명만
필수(`POLICY_REQUIRED_FIELDS` 등, 각 `src/types/*.ts`)이고 나머지는 전부 선택 항목이다.
값이 없으면 문자열 필드는 zod 스키마의 `.default("")`(또는 termsConditions의 useStatus="사용"/
requiredStatus="선택"/deviceCategory="공통")로 채워진다. 새 필수 필드를 늘리고 싶어질 때는
"등록 시 반드시 있어야만 그 레코드가 의미가 있는가"(예: 식별용 관리코드)로 판단하고, 그 외에는
선택 항목으로 두는 편이 엑셀 대량 업로드 시 오류로 막히는 행을 줄인다.

> **주의(캐시)**: `recordStore.ts`는 모듈 레벨 in-memory 캐시를 쓴다. 서버 프로세스가 떠 있는
> 동안 `data/knowledge/*.json`을 직접 손으로 편집하면, 다음 쓰기(create/revise) 때 서버가
> 들고 있던 **캐시가 그 편집을 덮어써서 되돌린다**. 데이터를 손으로 고쳐야 하면 반드시 dev
> 서버를 먼저 내린 뒤 편집하고, 그 상태로 서버를 새로 띄운다.

### 조회(RAG): 임베딩 없는 토큰 매칭

Vector DB 없이 `recordStore.search()`가 질의를 공백 기준 토큰으로 나눠 각 항목의
`searchableText`에 얼마나 매칭되는지 점수를 매겨 정렬한다(OR 매칭 + 매칭 토큰 수로 랭킹).
전체 문자열을 통째로 `includes()`하면 "채번규칙 정책"처럼 원문에 그대로 붙어있지 않은
다단어 질의가 0건이 되므로 반드시 토큰 단위로 나눠야 한다. 나중에 데이터가 커지면 이
인터페이스(`search(query): StoredRecord[]`)를 유지한 채 내부만 pgvector/Chroma 기반 임베딩
검색으로 교체할 수 있다.

### LLM 에이전트: tool calling 기반 대화형 폼 채우기 (세션 상태 없음)

`src/agent/`는 OpenAI `gpt-5.5`를 tool calling으로 호출한다. 서버는 세션을 저장하지 않고,
프론트엔드가 들고 있는 전체 대화 이력(`messages`)을 매 요청마다 그대로 보낸다 —
`runChatTurn()`이 이번 턴에 새로 생긴 메시지(tool_calls 포함 assistant 메시지, tool 결과,
최종 답변)를 `appendedMessages`로 돌려주면 프론트엔드가 그걸 자기 history 뒤에 이어붙여
다음 요청 때 다시 보낸다. 이렇게 해야 "지금까지 파악한 등록 필드"가 여러 턴에 걸쳐 유지된다.

- **주의**: `gpt-5.5`(추론형 모델)는 `/v1/chat/completions`에서 function tools와
  `reasoning_effort`를 함께 쓸 수 없다("Function tools with reasoning_effort are not
  supported ... set reasoning_effort to 'none'"). tools를 넘기는 호출은 반드시
  `reasoning_effort: "none"`을 쓴다. (tools 없이 순수 텍스트 생성만 하는 호출이라면 이전처럼
  `"low"` 등을 쓸 수 있다.)
- `draft_policy`/`draft_term`/`draft_terms_conditions` 툴은 **DB에 아무것도 쓰지 않는다.**
  지금까지 파악한 필드를 검증해 `missingFields`(누락된 필수 항목의 한국어 라벨)와
  `status: "ready"|"incomplete"`만 돌려준다. `status: "ready"`가 되면 서버가 그 결과를
  응답의 `card`로 실어 보내고, 프론트엔드는 확인 카드를 띄운다. 실제 저장은 사용자가 카드의
  "등록" 버튼을 눌러 `/api/registry/confirm`을 호출해야만 일어난다 — 에이전트가 스스로
  "등록했습니다"라고 말하게 하는 코드/프롬프트를 추가하지 않는다.
- `author`/`updatedAt`은 도구 스키마에 없다 — 로그인 세션(`getCurrentUser()`)에서만 채운다.
  사용자가 자기 이름을 자체 신고하는 방식은 쓰지 않는다.

### 엑셀 업로드: 파싱(결정적 규칙) → 검증 모달(사용자 검수) → 일괄 커밋

`src/parser/excelParser.ts`의 `parsePolicyWorkbook()`은 AI가 아니라 **결정적 규칙**만 쓴다:
시트명에 '정책'/'용어'/'약관'이 포함되는지로 타입을 정하고, 헤더 별칭 사전(`POLICY_ALIASES`
등)으로 컬럼을 고정 필드에 매핑한 뒤 필수값/이넘(사용여부·필수여부)을 검증한다. 이전 버전의
AI 정제(`refine`) + 검수 대기(`staging`) 2단계 파이프라인은 없앴다 — 프론트엔드의 파싱
검증 모달(인라인 수정 가능한 표)이 곧 사용자 검수 단계이므로, 모달에서 "일괄 등록"을 누르면
`/api/excel/commit`이 즉시 각 스토어에 커밋한다(검증 실패한 행만 건너뛰고 실패 목록을
반환한다). 시트에 원래 작성자/작성일 컬럼이 있으면 그 값을 그대로 존중하고, 없는 행만
업로드한 사용자/현재 시각으로 채운다.

병합 셀·2단 헤더(그룹 헤더+세부 헤더) 자동 감지 로직(`sheetToRows` 내부의 forward-fill,
헤더 시작/끝 행 판단 등)은 실제 사내 엑셀 양식(제목행/병합 헤더가 섞인 문서)을 다루기 위한
것이므로, 헤더 판단 순서(원본 값 기준 판단 → 병합 채우기는 그 다음)를 바꾸지 않는다.

`ExcelValidationModal`/`ParsingValidationTable`은 모달 안에서 원하지 않는 행을 "삭제" 버튼으로
빼고 등록할 수 있다(로컬 state에서만 제거, 서버에는 애초에 보내지 않음) — 오류가 있는 행을
억지로 통과시키는 게 아니라, 필수 필드(이름)만 맞으면 통과되고 나머지는 사용자가 직접 정리하는
방식이다.

### 단일 채팅 화면: 대화 시작 전/후 레이아웃 전환

`ChatWindow.tsx`는 `display`(렌더링용 메시지 목록)가 비어 있으면(첫 메시지 전) 입력창을 화면
중앙에 두고(Claude 스타일), 안내 문구는 별도 메시지 버블이 아니라 입력창 placeholder
(`INPUT_PLACEHOLDER`)로만 보여준다. 첫 메시지를 보내는 순간 `display`가 비지 않게 되어
일반적인 "위쪽 메시지 목록 + 아래쪽 고정 입력창" 레이아웃으로 전환된다. 두 레이아웃은 같은
`composer` JSX를 재사용한다 — 입력창 관련 로직을 두 곳에 복사하지 않는다.

## 3. 폴더 구조

| 경로 | 역할 |
|---|---|
| `src/config/env.ts` | 환경변수 로드 및 zod 검증 |
| `src/types/{policy,term,termsConditions}.ts` | 3종 고정 스키마, 필수 필드 목록, 필드 라벨 |
| `src/types/activity.ts` | 엔티티 종류에 상관없이 남기는 활동 로그 타입 |
| `src/parser/excelParser.ts` | 엑셀 → 시트별 고정 필드 매핑 + 검증 (판단 없음, 결정적 규칙) |
| `src/db/recordStore.ts` | 3개 스토어가 공유하는 "JSON 파일 + 개정 이력" 팩토리 |
| `src/db/{policyStore,termStore,termsConditionsStore}.ts` | 엔티티별 스토어 인스턴스 |
| `src/db/registry.ts` | 스토어 생성/개정 + 활동 로그 기록을 함께 하는 상위 함수 |
| `src/agent/tools.ts` | tool 정의(JSON Schema) + 실행 함수(search_knowledge, draft_*) |
| `src/agent/chatAgent.ts` | tool calling 루프 (세션 상태 없이 매 요청 전체 이력 처리) |
| `src/auth/` | 로그인 세션(HMAC 서명 쿠키) 및 사용자 저장소 (`data/users.json`) |
| `src/app/page.tsx` | 로그인 필요 — 루트가 곧 단일 채팅 화면(별도 페이지 이동 없음) |
| `src/app/components/chat/` | ChatShell/ChatWindow/MessageBubble/ConfirmCard/SlashCommandMenu/ExcelValidationModal/ParsingValidationTable/RecordListModal |
| `src/app/api/chat` | 대화 1턴 처리 (tool calling, 세션 미저장) |
| `src/app/api/excel/parse`, `/commit` | 엑셀 업로드 파싱 / 검증 모달에서 확정한 행 일괄 커밋 |
| `src/app/api/registry/confirm` | 대화형 등록의 확인 카드에서 "등록" 클릭 시 커밋 |
| `src/app/api/policies`, `/terms`, `/terms-conditions` | 읽기 전용 GET — 헤더의 "목록 보기"(`RecordListModal`)가 사용. `?q=`로 검색 |
| `scripts/migrate-legacy-data.ts` | 이전 버전(동적 필드) 데이터를 새 고정 스키마로 옮기는 1회성 마이그레이션 |
| `data/knowledge/{policies,terms,terms_conditions}.json` | 엔티티별 지식창고 |
| `data/users.json` | 회원 계정 (비밀번호는 scrypt 해시로만 저장) |

### 인증 (이전 버전과 동일하게 유지)

`src/auth/session.ts`가 `SESSION_SECRET`으로 서명한 쿠키(`policy_agent_session`)를 발급/검증한다.
비밀번호는 scrypt로 해시(솔트 별도 저장)하며 평문으로 저장하지 않는다. 서버 라우트에서 현재
사용자를 알아야 할 때는 반드시 `getCurrentUser()`(쿠키 서명을 실제로 검증)를 쓴다.

## 4. 개발 가이드라인

- **환경**: Node.js 20+, TypeScript, ESM (`"type": "module"`), Next.js(App Router) + Tailwind
  CSS v4. `tsconfig.json`은 `moduleResolution: "bundler"` + `noUncheckedIndexedAccess: true`를
  쓴다 — 인덱스 접근 결과는 항상 `T | undefined`로 취급하고 `??`로 기본값을 준다.
- **환경변수**: 모든 외부 연동 키/경로는 `.env`에 두고 `src/config/env.ts`를 통해서만 읽는다.
  새 데이터 경로나 외부 연동을 추가하면 `.env.example`과 `env.ts`의 zod 스키마를 함께 갱신한다.
- **OpenAI API 사용**: 모델은 `gpt-5.5`. tool calling을 쓰는 호출은 `reasoning_effort: "none"`
  (위 "LLM 에이전트" 절 참고). 구조화된 출력이 필요한 다른 곳에서는 기존처럼
  `client.chat.completions.parse` + `zodResponseFormat`을 쓸 수 있다.
- **등록은 반드시 사용자 확인을 거친다**: 대화형 등록이든 엑셀 업로드든, 사용자가 확인
  카드/검증 모달에서 명시적으로 확정(등록 버튼 클릭)하기 전에 서버가 먼저 스토어에 커밋하는
  코드를 추가하지 않는다.
- **고정 스키마를 동적 필드로 되돌리지 않는다**: 새로운 엑셀 컬럼이 보이면 해당 엔티티
  스키마(`src/types/*.ts`)에 필드를 추가하고 `POLICY_ALIASES` 등 헤더 별칭 사전을 갱신한다 —
  `fields: {key,value}[]` 같은 범용 구조로 되돌리지 않는다.
- 불필요한 주석/추상화를 추가하지 않는다. `recordStore.ts`처럼 3개 엔티티가 정말 동일한
  동작을 공유할 때만 공통 팩토리를 쓴다.

## 5. 실행

```bash
npm install
cp .env.example .env   # 키 채워넣기 (OPENAI_API_KEY, SESSION_SECRET 등)

npm run dev             # Next.js 개발 서버 — 최초 접속 시 /signup에서 회원가입 필요
npm run build && npm start
npm run typecheck
npm test                # node:test 기반 단위 테스트 (엑셀 파서/스토어/에이전트 툴)
npm run migrate:legacy  # 이전 버전 data/knowledge/policy.json → 새 3종 스토어로 1회성 이관
```
