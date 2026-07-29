import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY가 필요합니다."),
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

export const env: Env = envSchema.parse(process.env);
