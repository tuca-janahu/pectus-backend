import { readFileSync } from "node:fs";
import { config, parse } from "dotenv";

config({ path: ".env", quiet: true });

const testDatabaseUrl = process.env.DATABASE_URL_TEST;

if (!testDatabaseUrl) {
  throw new Error("DATABASE_URL_TEST deve estar definida para os testes de integracao.");
}

// Le o valor original de DATABASE_URL direto do arquivo .env, pois scripts/test-integration.mjs
// ja substitui process.env.DATABASE_URL por DATABASE_URL_TEST antes de invocar o vitest.
const envFile = parse(readFileSync(".env"));

if (testDatabaseUrl === envFile.DATABASE_URL) {
  throw new Error("DATABASE_URL_TEST deve apontar para um banco diferente do ambiente de desenvolvimento.");
}

process.env.DATABASE_URL = testDatabaseUrl;
