import { defineConfig } from "drizzle-kit";
import { config } from "./src/config";

export default defineConfig({
  schema: "./src/db/schema/*.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    host: config.PGHOST,
    port: config.PGPORT,
    user: config.PGUSER,
    password: config.PGPASSWORD,
    database: config.PGDATABASE,
    ssl: false,
  },
});
