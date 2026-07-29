# 디자인 시스템 — B2B SaaS 정책 관리 대시보드

Clean / Modern / Professional B2B SaaS Dashboard. 눈이 편안한 뉴트럴 배경, 부드러운 라운딩, 얇고 명확한
구분선, 활기찬 블루 포인트 컬러가 핵심 톤이다.

토큰의 실제 소스는 `src/app/globals.css`의 `@theme` 블록이다(Tailwind v4, CSS-first 설정).
`tailwind.config.js`는 동일 토큰을 클래식 포맷으로 미러링한 참고용 파일이다. 값을 바꿀 때는 두 파일을
함께 갱신한다.

---

## 1. 컬러 토큰

| 용도 | 토큰 (CSS 변수) | 값 | Tailwind 클래스 |
|---|---|---|---|
| 페이지 배경 | `--color-page-bg` | `#F8F9FA` | `bg-page-bg` |
| 카드/패널 배경 | `--color-surface` | `#FFFFFF` | `bg-surface` |
| Primary(코랄/오렌지 액센트) | `--color-primary` | `#D85A30` | `bg-primary` `text-primary` `border-primary` |
| Primary Hover | `--color-primary-hover` | `#C14E27` | `hover:bg-primary-hover` |
| 본문 텍스트(Primary) | `--color-ink` | `#111827` | `text-ink` |
| 보조 텍스트(Secondary) | `--color-subtle` | `#6B7280` | `text-subtle` |
| 구분선 | `--color-border` | `#E5E7EB` | `border-border` |
| 옅은 구분선 | `--color-border-subtle` | `#EEF0F4` | `border-border-subtle` |
| Success 배지 배경/텍스트 | `--color-success-bg` / `--color-success` | `#ECFDF5` / `#047857` | `bg-success-bg text-success` |
| Danger 배지 배경/텍스트 | `--color-danger-bg` / `--color-danger` | `#FEF2F2` / `#DC2626` | `bg-danger-bg text-danger` |
| Warning 배지 배경/텍스트 | `--color-warning-bg` / `--color-warning` | `#FEF3C7` / `#D97706` | `bg-warning-bg text-warning` |

**원칙**: 카드/패널은 항상 `bg-surface` 위에 얹고, 페이지 자체는 `bg-page-bg`를 깐다. 상태 배지는
"연한 배경 + 진한 텍스트" 조합만 쓰고, 절대 채워진(solid) 배경에 흰 텍스트를 쓰지 않는다(과한 대비 지양).

---

## 2. 타이포그래피

폰트는 Inter(`next/font/google`로 자체 호스팅, `--font-inter` 변수 → `--font-sans` 토큰). 새로운
font-size 토큰을 만들지 않고 Tailwind 기본 스케일에 계층을 매핑한다.

| 계층 | 클래스 | 크기 | 굵기 | 용도 |
|---|---|---|---|---|
| Page Title | `text-2xl font-bold text-ink` | 24px | Bold | 화면 최상단 제목 |
| Section Title | `text-base font-semibold text-ink` (또는 `text-[15px]`) | 15–16px | Semibold | 카드/섹션 헤더 |
| Body / Table | `text-sm text-ink` | 14px | Regular/Medium | 표 본문, 폼 인풋 |
| Caption / Metadata | `text-xs text-subtle` | 12px | Regular | 라벨, 타임스탬프, 보조 설명 |

---

## 3. 여백·라운딩·그림자

| 구분 | 규칙 |
|---|---|
| 카드/패널/드로어 라운딩 | `rounded-card` (16px) |
| 버튼/인풋 라운딩 | `rounded-control` (10px) |
| 뱃지 라운딩 | `rounded-pill` (완전한 캡슐형) |
| 그림자 | `shadow-card` (`0 1px 3px rgba(0,0,0,0.05)`)만 사용. 그 이상 진한 `shadow-lg` 등은 지양 |
| 구획 분리 | 그림자보다 `border border-border`(1px 실선)를 우선한다 |
| 카드 내부 패딩 | `p-5` ~ `p-6` |
| 카드 간 간격 | `gap-4` ~ `gap-6` |

---

## 4. 핵심 컴포넌트

### 4.1 LNB (좌측 내비게이션)

- 세로 스크롤 메뉴, 아이콘 + 텍스트 조합, 폭 고정(`w-60` 권장).
- 배경은 `bg-surface`, 우측에 `border-r border-border`로 본문과 분리.
- 기본 항목: `text-sm text-subtle`, 아이콘은 `text-subtle`.
- **선택된 항목**: `bg-primary/10 text-primary font-medium` (Soft Blue 배경 + Primary 텍스트) + 좌측
  또는 아이콘에 `text-primary` 포인트.
- 항목 높이 `h-10`, 좌우 패딩 `px-3`, 라운딩 `rounded-control`.

### 4.2 데이터 테이블 / 정책 리스트

- 헤더 행: `text-xs font-medium uppercase tracking-wide text-subtle`, 하단 `border-b border-border`.
- 각 행(`tr`): `border-b border-border-subtle`, 클릭 가능(`cursor-pointer`).
  - **hover**: `hover:bg-page-bg/60`
  - **활성(선택됨, 드로어가 열린 대상)**: `bg-primary/5` + 좌측에 2px `border-l-2 border-primary` 강조.
- 셀 구성 요소:
  - 아바타/아이콘(선택): `size-8 rounded-full bg-page-bg`
  - Status Badge: §4.3
  - Action(수정/삭제) 버튼: 텍스트 버튼, 기본은 `text-subtle`, 위험 동작(삭제)만 `text-danger`,
    hover 시 `hover:bg-page-bg`.

### 4.3 Status Badge

`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-medium`에 상태별 배경/텍스트 조합:

| 상태 | 클래스 |
|---|---|
| Success / Active | `bg-success-bg text-success` |
| High / Warning(위험) | `bg-danger-bg text-danger` |
| Medium / Pending | `bg-warning-bg text-warning` |

### 4.4 우측 상세/수정 드로어 (Side Drawer)

리스트에서 행을 클릭하면 우측에서 슬라이드인되는 패널. 목록과 드로어는 **같은 화면에서 동시에** 보인다
(전체 화면 전환이 아니라 오버레이).

**구조**

```
┌───────────────────────────────┬───────────────┐
│  헤더 (제목 · 상태뱃지)         │  드로어 헤더    │
│  ─────────────────────────    │  (닫기 X / 제목)│
│  검색/필터 바                  │  ─────────────  │
│  ─────────────────────────    │  [조회 | 수정] │
│  테이블(행 클릭 → 드로어 오픈)  │  본문 콘텐츠    │
│                                │  (스크롤 가능)  │
│                                │  ─────────────  │
│                                │  Footer 액션    │
└───────────────────────────────┴───────────────┘
```

- 폭: `w-[420px]` ~ `w-[480px]` (뷰포트 좁으면 전체 폭), 배경 `bg-surface`, 좌측
  `border-l border-border`(또는 `shadow-card`로 대체), `rounded-card`는 데스크톱 오버레이일 때만.
- 배경 오버레이(옵션): 모바일/좁은 화면에서는 `bg-black/20` 백드롭 + 드로어, 넓은 화면(대시보드 기본)에서는
  백드롭 없이 목록 옆에 나란히 배치해도 된다(협업툴형 레이아웃).
- 헤더: 정책명(`text-lg font-semibold`), 카테고리 뱃지, 닫기 버튼(우측 상단, `text-subtle hover:text-ink`).
- **조회(Read) ↔ 수정(Edit) 모드 전환**: 헤더 아래 우측에 "수정" 버튼 하나만 노출.
  - Read 모드: 필드가 읽기 전용 텍스트(`text-sm text-ink`, 라벨은 `text-xs text-subtle`)로 렌더링.
    하단에 변경 이력(개정 번호 · 작성자 · 일시) 리스트.
  - "수정" 클릭 → 같은 자리의 필드들이 인풋/셀렉트/토글로 교체(Edit 모드). 버튼은 "저장"/"취소"로 바뀐다.
  - "저장" 성공 시 Read 모드로 복귀하고 갱신된 값을 반영, 이력에 새 스냅샷이 추가된다.
  - "취소" 시 원래 값으로 되돌리고 Read 모드로 복귀(입력값 폐기).
- Footer(선택): 위험 동작(삭제)은 드로어 하단에 별도 구분선 아래 배치, `text-danger`.

---

## 5. 인터랙션 가이드

- **행 클릭 → 드로어**: 클릭 즉시 해당 행에 활성 스타일(§4.2)을 적용하고 드로어를 연다. 드로어가 이미
  열려 있는 상태에서 다른 행을 클릭하면 드로어 콘텐츠만 즉시 교체한다(닫았다 다시 열지 않음).
- **드로어 열기/닫기 애니메이션**: `translate-x-full` → `translate-x-0`, `transition-transform duration-200 ease-out`.
  닫을 때는 역방향. 과도한 바운스/스프링 애니메이션은 쓰지 않는다.
- **닫기 트리거**: 헤더의 X 버튼, `Esc` 키, (백드롭이 있는 경우) 백드롭 클릭. 수정 모드에서 저장하지
  않은 변경사항이 있으면 닫기 전에 확인한다.
- **모드 전환**: 조회 ↔ 수정은 드로어를 닫지 않고 그 자리에서 콘텐츠만 바뀐다(전체화면 전환 금지).
- **저장/취소 위치 고정**: Edit 모드의 저장/취소 버튼은 드로어 하단에 고정(sticky footer)해 스크롤해도
  항상 보이게 한다.
- **포커스**: 드로어가 열리면 첫 포커스는 닫기 버튼 또는 첫 필드로 이동(접근성).

---

## 6. 적용 현황

프로젝트가 멀티 페이지 대시보드에서 **단일 대화창** UI로 전면 재구성되면서, §4.1(LNB)과
§4.4(우측 드로어)는 더 이상 쓰이지 않는다(리스트+드로어 화면 자체가 없다). §1~3의 컬러/타이포/
여백·라운딩 토큰은 그대로 소스 오브 트루스이며, 아래 채팅 컴포넌트들이 이를 그대로 따른다.

- `src/app/components/chat/ChatShell.tsx`, `ChatWindow.tsx` — 상단 바 + 메시지 리스트 + 입력창
- `src/app/components/chat/SlashCommandMenu.tsx` — `/` 입력 시 뜨는 빠른 명령 드롭다운
- `src/app/components/chat/ConfirmCard.tsx` — 대화형 등록의 확인 카드(§4.3 배지 톤 재사용)
- `src/app/components/chat/ExcelValidationModal.tsx`, `ParsingValidationTable.tsx` — 엑셀 파싱
  검증 모달(§4.2 테이블 톤 재사용, 오류 셀은 `bg-danger-bg`/`border-danger`로 하이라이트)
