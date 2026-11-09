import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: { url: process.env.DATABASE_URL || "postgresql://USER:PASSWORD@HOST:5432/DATABASE_NAME" },
});
