import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables
dotenv.config();

const envSchema = z.object({
  API_PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  API_DOMAIN: z.string().url().default("http://localhost:3001"),
  WEBSITE_DOMAIN: z.string().url().default("http://localhost:8081"),

  PGHOST: z.string().default("postgres"),
  PGPORT: z.coerce.number().default(5432),
  PGUSER: z.string().default("dietscan"),
  PGPASSWORD: z.string().default(() => process.env.POSTGRES_PASSWORD || "change_me_in_production"),
  PGDATABASE: z.string().default("dietscan_core"),

  SUPERTOKENS_URI: z.string().url().default("http://supertokens:3567"),
  SUPERTOKENS_API_KEY: z.string().default("some-random-api-key"),

  VALKEY_URL: z.string().default("redis://valkey:6379"),

  JWT_SECRET: z.string().default("change_me_in_production_use_64_char_random"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables:", JSON.stringify(parsedEnv.error.format(), null, 2));
  process.exit(1);
}

export const config = parsedEnv.data;
export type Config = typeof config;
