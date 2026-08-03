# 라이선스 및 오픈소스 사용 내역

## 이 프로젝트 자체

내부 업무용 도구로, 별도의 오픈소스 라이선스를 지정하지 않은 사내 전용/비공개 프로젝트입니다
(`package.json`의 `"private": true`). 외부 배포/재배포를 전제로 하지 않습니다.

## 주요 오픈소스 의존성 및 라이선스

`node_modules/<패키지>/package.json`의 `license` 필드를 직접 확인한 값입니다
(전체 트랜지티브 의존성 목록은 `npm ls --all` 또는 `package-lock.json` 참고).

| 패키지 | 용도 | 라이선스 |
|---|---|---|
| [next](https://github.com/vercel/next.js) | 프레임워크 (App Router) | MIT |
| [react](https://github.com/facebook/react) / react-dom | UI 렌더링 | MIT |
| [openai](https://github.com/openai/openai-node) | LLM 클라이언트 SDK (Gemini의 OpenAI 호환 엔드포인트 호출에 재사용) | Apache-2.0 |
| [zod](https://github.com/colinhacks/zod) | 스키마 검증 | MIT |
| [dotenv](https://github.com/motdotla/dotenv) | 환경변수 로드 | BSD-2-Clause |
| [xlsx (SheetJS CE)](https://git.sheetjs.com/sheetjs/sheetjs) | 엑셀 파싱/생성 | Apache-2.0 |
| [tailwindcss](https://github.com/tailwindlabs/tailwindcss) | 스타일링 | MIT |
| [typescript](https://github.com/microsoft/TypeScript) | 언어/컴파일러 (devDependency) | Apache-2.0 |
| [tsx](https://github.com/privatenumber/tsx) | TS 스크립트 실행 (devDependency) | MIT |

MIT/BSD-2-Clause/Apache-2.0 모두 상업적 사용·수정·재배포를 허용하는 permissive 라이선스로,
저작권/라이선스 고지 유지 외 별다른 제약이 없습니다. Apache-2.0 계열(openai, xlsx,
typescript)은 추가로 특허 실시권 조항을 포함합니다.

## 외부 API

- **Google Gemini API**: [Google APIs 서비스 약관](https://developers.google.com/terms) 및
  [Gemini API 추가 약관](https://ai.google.dev/gemini-api/terms) 적용. 무료 티어 사용 —
  요금제/약관은 Google 측 정책 변경에 따라 달라질 수 있습니다.
- **Railway**: 배포 플랫폼. [Railway 약관](https://railway.com/legal/terms) 적용.
