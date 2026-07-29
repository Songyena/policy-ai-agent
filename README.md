# 정책 Agent — 단일 대화창 기반 사내 정책 통합 관리 AI

정책(Policies) / 표준 용어집(Glossary) / 이용약관(Terms & Conditions)을 **하나의 대화창**에서
조회, 대화형 등록, 엑셀 일괄 업로드·검증까지 처리하는 사내 AI 에이전트입니다.

아키텍처와 개발 규칙은 [`CLAUDE.md`](./CLAUDE.md)에 자세히 정리되어 있습니다.

---

## 핵심 기능

- **단일 대화창**: 메뉴 이동 없이 하나의 채팅 UI에서 조회/등록/엑셀 업로드를 모두 처리합니다.
- **슬래시 커맨드**: `/정책`, `/용어`, `/약관`, `/엑셀` 입력 시 빠른 명령 메뉴가 뜹니다.
- **대화형 폼 채우기**: 자연어로 등록을 요청하면 LLM이 누락된 필수 항목만 되물은 뒤 확인 카드를
  띄우고, 사용자가 "등록" 버튼을 눌러야 실제로 저장됩니다.
- **엑셀 업로드 및 검증**: `.xlsx`를 올리면 '정책'/'용어'/'이용약관' 시트를 자동 인식해 고정
  스키마로 매핑하고, 필수값 누락/형식 오류를 표에서 빨간색으로 표시합니다. 인라인 수정 후
  일괄 등록할 수 있습니다.

## 기술 스택

- **Framework**: Next.js 16 (App Router, TypeScript), Tailwind CSS v4
- **LLM**: OpenAI `gpt-5.5` (function/tool calling)
- **엑셀 파싱**: `xlsx`(SheetJS) — 병합 셀·다단 헤더 자동 감지
- **데이터 저장**: JSON 파일 기반 지식창고 (`data/knowledge/*.json`) — 정책/용어/이용약관 각각 독립 파일
- **인증**: 아이디/비밀번호 + 서명된 세션 쿠키 (scrypt 해시)

## 시작하기

```bash
npm install
cp .env.example .env   # OPENAI_API_KEY, SESSION_SECRET 채워넣기

npm run dev             # http://localhost:3000
npm run typecheck
npm test                # node:test 기반 단위 테스트
```

최초 접속 시 `/signup`에서 계정을 만들어야 합니다.

### 레거시 데이터 마이그레이션

이전 버전(동적 필드 구조)의 `data/knowledge/policy.json`이 남아있다면, 아래 명령으로
새 고정 스키마(정책/용어/이용약관) 스토어로 옮길 수 있습니다. 원본 파일은 건드리지 않으며,
여러 번 실행해도 같은 키(구분+정책명+세부항목 / 표준용어 / 관리코드)는 중복 생성되지 않고
개정으로 처리됩니다.

```bash
npm run migrate:legacy
```

정책 스키마에 맞지 않아 원문을 통째로 옮긴 항목, 사용여부/필수여부 값이 예상 범위를 벗어난
항목은 실행 결과에 별도로 나열되니 수동으로 검토하세요.

## 데이터 스키마

| 정책 (Policies) | 용어 (Terms) | 이용약관 (Terms & Conditions) |
|---|---|---|
| 구분(category) | 표준 용어(standardTerm) | 사용여부(useStatus) |
| 정책명(policyName) | 유사어(synonyms[]) | 필수여부(requiredStatus) |
| 세부항목(subItem) | 노출 메뉴(uiMenu) | 기기구분(deviceCategory) |
| 설명1(ruleDesc) | 개념(definition) | 약관명(termsName) |
| 설명2(detailDesc) | 비고(note) | 파일명(fileName) |
| 예시(example) | 작성/수정자(author) | 관리코드(manageCode) |
| 작성/수정자(author) | 작성/수정일(updatedAt) | 개정일자(revisionDate) |
| 작성/수정일(updatedAt) | | 작성/수정자·작성/수정일 |

각 레코드는 `revision`/`history`로 개정 이력을 보존합니다. 자세한 필드/검증 규칙은
`src/types/policy.ts`, `src/types/term.ts`, `src/types/termsConditions.ts`를 참고하세요.
