import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY가 필요합니다."),
  RAW_DATA_DIR: z.string().default("./data/raw"),
  POLICIES_DATA_PATH: z.string().default("./data/knowledge/policies.json"),
  TERMS_DATA_PATH: z.string().default("./data/knowledge/terms.json"),
  TERMS_CONDITIONS_DATA_PATH: z.string().default("./data/knowledge/terms_conditions.json"),
  ACTIVITY_LOG_PATH: z.string().default("./data/knowledge/activity.json"),
  USERS_DATA_PATH: z.string().default("./data/users.json"),
  SESSION_SECRET: z.string().min(1, "SESSION_SECRET이 필요합니다."),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

/**
 * 필수 환경변수가 없으면 앱이 정상 동작할 수 없으므로 여전히 예외를 던진다 — 다만 이 모듈은
 * 거의 모든 요청 경로에서 트랜지티브하게 import되므로, 어떤 값이 왜 빠졌는지 로그에 명확히
 * 남겨야 (Railway 등에서) 매 요청마다 같은 원인 불명 에러가 반복되는 상황을 바로 진단할 수 있다.
 */
function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join(".")} (${issue.message})`).join(", ");
    console.error(`[env] 환경변수 검증 실패: ${details}`);
    throw new Error(`환경변수 검증 실패: ${details}`);
  }
  return result.data;
}

export const env: Env = loadEnv();
