# 정책 Agent — 단일 대화창 기반 사내 정책 통합 관리 AI

정책(Policies) / 표준 용어집(Glossary) / 이용약관(Terms & Conditions)을 **하나의 대화창**에서
조회, 대화형 등록, 엑셀 일괄 업로드·검증까지 처리하는 사내 AI 에이전트입니다.

- **실행 가능한 결과물**: https://policy-ai-agent-production.up.railway.app
- **저장소**: https://github.com/Songyena/policy-ai-agent
- **아키텍처/설계 문서**: [`ARCHITECTURE.md`](./ARCHITECTURE.md) (에이전트 설계), [`CLAUDE.md`](./CLAUDE.md) (개발 규칙), [`PROMPTS.md`](./PROMPTS.md) (시스템 프롬프트/도구 정의)

---

## 핵심 기능

- **단일 대화창**: 메뉴 이동 없이 하나의 채팅 UI에서 조회/등록/엑셀 업로드를 모두 처리합니다.
  대화 시작 전에는 입력창이 화면 중앙에 오고, 첫 메시지를 보내면 일반 채팅 레이아웃으로 바뀝니다.
- **슬래시 커맨드**: `/정책`, `/용어`, `/약관`, `/엑셀` 입력 시 빠른 명령 메뉴가 뜹니다.
- **대화형 폼 채우기**: 자연어로 등록을 요청하면 LLM이 누락된 필수 항목(이름 필드 하나뿐)만
  되물은 뒤 확인 카드를 띄우고, 사용자가 "등록" 버튼을 눌러야 실제로 저장됩니다.
- **엑셀 업로드 및 검증**: `.xlsx`를 올리면 '정책'/'용어'/'이용약관' 시트를 자동 인식해 고정
  스키마로 매핑하고, 필수값 누락/형식 오류를 표에서 빨간색으로 표시합니다. 인라인 수정은 물론
  원치 않는 행은 삭제한 뒤 일괄 등록할 수 있습니다.
- **목록 보기 / 삭제 / 변경 이력**: 사이드바의 "정책 목록" 메뉴로 등록된 정책/용어/이용약관을
  탭+검색+아코디언으로 조회하고, 항목별로 바로 삭제할 수 있습니다. "변경 이력" 탭에서는
  등록/수정/삭제 이력을 최신순으로(수정은 변경 전/후, 삭제는 삭제 당시 스냅샷과 함께) 확인할 수
  있습니다.
- **대화 세션 저장**: 로그인 사용자의 대화가 `data/chats/`에 날짜별로 저장되고, 24시간
  (`CHAT_RETENTION_HOURS`)이 지나면 자동으로 정리됩니다.

## 기술 스택

- **Framework**: Next.js 16 (App Router, TypeScript), Tailwind CSS v4
- **LLM**: Google Gemini(`gemini-3.1-flash-lite`), `openai` SDK를 Gemini의 OpenAI 호환
  엔드포인트로 그대로 사용 (function/tool calling)
- **엑셀 파싱**: `xlsx`(SheetJS) — 병합 셀·다단 헤더 자동 감지
- **데이터 저장**: JSON 파일 기반 지식창고 (`data/knowledge/*.json`) — 정책/용어/이용약관 각각 독립 파일
- **인증**: 아이디/비밀번호 + 서명된 세션 쿠키 (scrypt 해시)

## 시작하기

```bash
npm install
cp .env.example .env   # GEMINI_API_KEY(https://aistudio.google.com/apikey), SESSION_SECRET 채워넣기

npm run dev             # http://localhost:3000
npm run typecheck
npm test                # node:test 기반 단위 테스트
```

최초 접속 시 `/signup`에서 계정을 만들어야 합니다.

### 레거시 데이터 마이그레이션

이전 버전(동적 필드 구조)의 `data/knowledge/policy.json`이 남아있다면, 아래 명령으로
새 고정 스키마(정책/용어/이용약관) 스토어로 옮길 수 있습니다. 원본 파일은 건드리지 않으며,
여러 번 실행해도 같은 키(정책명+세부항목 / 표준용어 / 관리코드)는 중복 생성되지 않고
개정으로 처리됩니다.

```bash
npm run migrate:legacy
```

정책 스키마에 맞지 않아 원문을 통째로 옮긴 항목, 사용여부/필수여부 값이 예상 범위를 벗어난
항목은 실행 결과에 별도로 나열되니 수동으로 검토하세요.

## 데모 시나리오 및 테스트 방법

`submission/sample-data/policy-agent-sample.xlsx`에 실명·실제 사내 정책 없이 만든 가공 예시
데이터(정책/용어/이용약관 각 시트)가 들어있습니다. 아래 시나리오는 이 파일을 기준으로 합니다.

### 0. 준비
1. 배포 URL(위 링크) 또는 로컬(`npm run dev` → http://localhost:3000)에서 `/signup`으로 계정 생성.

### 1. 자연어 조회 (RAG 검색, 할루시네이션 방지 확인)
1. 로그인 후 첫 화면에서 "주문번호 채번규칙 알려줘"처럼 샘플 데이터에 있는 내용을 질문 → 검색
   결과에 근거한 답변이 오는지 확인.
2. 지식창고에 없는 내용(예: "탈퇴 정책 알려줘")을 질문 → "현재 지식창고에서 해당 내용을 찾을 수
   없습니다"라고 답하는지(추측하지 않는지) 확인.

### 2. 슬래시 커맨드 + 대화형 등록
1. 입력창에 `/`를 입력해 빠른 명령 메뉴 확인.
2. `/정책` 선택 후 "환불 정책 등록할게, 정책명은 단순변심 환불" 처럼 자연어로 입력.
3. 정책명 외 나머지 항목은 안 물어보고(선택 항목), 확인 카드가 뜨는지 확인.
4. 카드에서 필드를 수정한 뒤 "등록" 클릭 → 등록 완료 메시지 확인 → "정책 목록"에서 조회.

### 3. 엑셀 업로드 일괄 등록
1. 채팅창의 📎 버튼(또는 `/엑셀`) 클릭 후 `submission/sample-data/policy-agent-sample.xlsx` 업로드.
2. 파싱 검증 모달에서 정책/용어/이용약관 3개 탭에 행이 채워지는지 확인(정상 샘플이라 오류 없이
   전부 통과해야 합니다).
3. (선택) 아무 행이나 정책명/표준용어/약관명을 지워보면 그 필드가 빨간색으로 표시되는지, "삭제"
   버튼으로 그 행만 제외하고 나머지를 등록할 수 있는지 확인.
4. "일괄 등록" 클릭 → 정책/용어/이용약관 각각 등록 건수 요약 확인.

### 4. 목록 조회 / 삭제 / 변경 이력
1. 사이드바 "정책 목록" → 정책/용어/이용약관 탭 전환, 검색창으로 실시간 필터링 확인.
2. 항목 클릭 시 아코디언으로 펼쳐지고, 여러 항목을 동시에 펼쳐둘 수 있는지 확인.
3. 아무 항목의 "삭제" → 확인 문구 → "확인"으로 삭제, 목록에서 사라지는지 확인.
4. "변경 이력" 탭에서 방금 삭제한 항목이 삭제 뱃지와 함께 최신순으로 보이고, 클릭 시 삭제 당시
   내용이 펼쳐지는지 확인. 같은 항목을 다시 등록/수정해보면 등록·수정 이력도 함께 쌓입니다.

### API 직접 테스트 (curl)
```bash
# 회원가입
curl -X POST http://localhost:3000/api/auth/signup -H "Content-Type: application/json" \
  -d '{"name":"테스트","username":"demo","password":"demo1234"}' -c cookies.txt

# 조회 (RAG)
curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -b cookies.txt \
  -d '{"messages":[{"role":"user","content":"주문번호 채번규칙 알려줘"}]}'

# 등록된 정책 목록
curl http://localhost:3000/api/policies -b cookies.txt

# 변경 이력
curl http://localhost:3000/api/activity -b cookies.txt
```

### 자동화된 테스트
```bash
npm run typecheck
npm test   # 엑셀 파서 / 레코드 스토어 / 에이전트 도구 단위 테스트 11건
```

## Railway 배포

이 앱은 정책/용어/이용약관/계정 데이터를 `data/` 아래 JSON 파일에 직접 읽고 씁니다
(`recordStore`의 메모리 캐시 포함). 그래서 요청마다 컨테이너가 새로 뜨는 서버리스(Vercel 등)
보다는, 계속 떠 있는 컨테이너에 **영속 볼륨**을 붙일 수 있는 Railway 같은 플랫폼이 잘 맞습니다.
`railway.json`에 빌드/실행 설정은 들어있지만, **볼륨은 config-as-code 파일로 지정할 수 없고
반드시 대시보드(또는 Railway CLI)에서 붙여야 합니다** — 아래 절차를 따라주세요.

### 1. 가입 → GitHub 연동 → 프로젝트 생성

1. [railway.com](https://railway.com)에 GitHub 계정으로 가입/로그인합니다.
2. 대시보드에서 **New Project → Deploy from GitHub repo**를 선택하고, 최초 1회 Railway GitHub
   App에 이 저장소(`Songyena/policy-ai-agent`) 접근 권한을 승인합니다.
3. 저장소를 선택하면 `package.json`(Node 20+ 지정, `engines.node`)과 `railway.json`을 자동
   인식해 Railpack 빌더로 `npm run build` → `npm start`를 실행하도록 구성됩니다. 별도 Node
   버전 설정은 필요 없습니다(이미 `package.json`의 `engines.node: ">=20.0.0"`으로 지정되어 있음).

### 2. 볼륨(Volume) 설정 — `data/` 영속화

1. 생성된 서비스 타일을 우클릭(또는 서비스 클릭 후 메뉴) → **Attach Volume**.
2. **Mount Path**를 `/app/data`로 지정합니다 — Railway의 Railpack 빌드는 앱을 컨테이너의 `/app`
   에 두므로, 코드가 쓰는 상대 경로 `./data/...`가 실제로는 `/app/data/...`로 풀립니다. 이 경로가
   맞아야 `data/knowledge/*.json`, `data/users.json`, `data/raw/*`가 전부 볼륨 안에 들어갑니다.
3. 볼륨 크기를 정하고 저장하면 서비스가 재배포됩니다. 이후 재배포/재시작을 해도 이 볼륨 안의
   데이터는 유지됩니다(볼륨을 안 붙이면 재배포 때마다 데이터가 초기화됩니다).

### 3. 환경변수

서비스 → **Variables** 탭에서 아래 값을 등록합니다.

| 변수 | 필수 여부 | 설명 |
|---|---|---|
| `GEMINI_API_KEY` | 필수 | 대화형 에이전트(tool calling)가 사용하는 Google Gemini API 키 |
| `SESSION_SECRET` | 필수 | 로그인 세션 쿠키 서명에 쓰는 임의의 긴 무작위 문자열 |
| `RAW_DATA_DIR`, `POLICIES_DATA_PATH`, `TERMS_DATA_PATH`, `TERMS_CONDITIONS_DATA_PATH`, `ACTIVITY_LOG_PATH`, `USERS_DATA_PATH` | 선택 | 기본값이 전부 `./data/...` 아래이므로, 볼륨을 `/app/data`에 붙였다면 따로 설정할 필요 없음 |

### 4. 실행 커맨드

`railway.json`에 이미 지정되어 있어 별도 설정이 필요 없습니다.

```json
{
  "build": { "builder": "RAILPACK", "buildCommand": "npm run build" },
  "deploy": { "startCommand": "npm start" }
}
```

### 5. 도메인 생성

서비스 → **Settings → Networking → Generate Domain**을 누르면 `*.up.railway.app` 형태의
공개 URL이 즉시 발급됩니다. 커스텀 도메인을 쓰려면 같은 화면의 **Custom Domain**에서 도메인을
추가하고 안내되는 CNAME 레코드를 DNS에 등록하면 됩니다.

### 트러블슈팅: "Application failed to respond" / 502 + connection refused

컨테이너 로그에는 `✓ Ready`가 정상적으로 찍히고 서비스 상태도 `Online`인데 공개 URL에 접속하면
502(`Application failed to respond`)가 뜬다면, **도메인의 Target Port가 앱이 실제로 리스닝하는
포트와 다른 경우**일 가능성이 높다 — 실제로 이 프로젝트에서 겪은 원인이다. Railway가 도메인을
처음 생성할 때 포트를 3000으로 추정해 넣어두는데, `next start`는 Railway가 그때그때 주입하는
`PORT` 환경변수를 그대로 따라가므로(예: 8080) 서로 어긋날 수 있다. 컨테이너/앱은 멀쩡히 떠 있고
Railway 프록시만 엉뚱한 포트로 연결을 시도하다 거부당하는 상황이라, 앱 로그에는 아무 에러도
남지 않는다.

확인 및 수정:

```bash
railway status --json   # domains[].targetPort 값을 확인
```

배포 로그에 찍힌 실제 리스닝 포트(`- Local: http://localhost:XXXX`)와 다르면:

```bash
railway domain update <발급된 도메인> --port <배포 로그에 찍힌 실제 포트>
```

또는 대시보드 **Settings → Networking**에서 도메인 옆의 포트 값을 직접 수정해도 된다.

## 데이터 스키마

| 정책 (Policies) | 용어 (Terms) | 이용약관 (Terms & Conditions) |
|---|---|---|
| 구분(category) | **표준 용어(standardTerm)** ✱필수 | 사용여부(useStatus) |
| **정책명(policyName)** ✱필수 | 유사어(synonyms[]) | 필수여부(requiredStatus) |
| 세부항목(subItem) | 노출 메뉴(uiMenu) | 기기구분(deviceCategory) |
| 설명1(ruleDesc) | 개념(definition) | **약관명(termsName)** ✱필수 |
| 설명2(detailDesc) | 비고(note) | 파일명(fileName) |
| 예시(example) | 작성/수정자(author) | 관리코드(manageCode) |
| 작성/수정자(author) | 작성/수정일(updatedAt) | 개정일자(revisionDate) |
| 작성/수정일(updatedAt) | | 작성/수정자·작성/수정일 |

각 종류마다 이름 필드(정책명/표준 용어/약관명) 하나만 필수이고 나머지는 전부 선택입니다.
비워두면 문자열은 빈 값, 이용약관의 사용여부/필수여부/기기구분은 각각 "사용"/"선택"/"공통"으로
기본값이 채워집니다. 각 레코드는 `revision`/`history`로 개정 이력을 보존합니다. 자세한
필드/검증 규칙은 `src/types/policy.ts`, `src/types/term.ts`, `src/types/termsConditions.ts`를
참고하세요.
