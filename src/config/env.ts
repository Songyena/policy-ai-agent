import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY가 필요합니다."),
  FIGMA_ACCESS_TOKEN: z.string().optional(),
  FIGMA_FILE_KEY: z.string().optional(),
  RAW_DATA_DIR: z.string().default("./data/raw"),
  STAGING_DATA_DIR: z.string().default("./data/staging"),
  DATABASE_PATH: z.string().default("./data/knowledge/policy.json"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
