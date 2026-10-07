import { defineConfig } from "drizzle-kit";
import { normalizeMySql2ConnectionUrl } from "./server/_core/mysql-url";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: normalizeMySql2ConnectionUrl(connectionString),
  },
});
