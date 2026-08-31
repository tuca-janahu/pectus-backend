import "dotenv/config";
import { defineConfig } from "prisma/config";

// `prisma generate` nao abre conexao, mas a CLI precisa de uma URL sintaticamente
// valida. Migrations e a aplicacao devem sempre receber DATABASE_URL real.
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://prisma:prisma@localhost:5432/prisma?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: databaseUrl },
});
