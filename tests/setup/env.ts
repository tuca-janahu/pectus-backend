import { config } from "dotenv";

config({ path: ".env", quiet: true });

const testDatabaseUrl = process.env.DATABASE_URL_TEST;

if (!testDatabaseUrl) {
  throw new Error("DATABASE_URL_TEST deve estar definida para os testes de integracao.");
}

if (testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL_TEST deve apontar para um banco diferente do ambiente de desenvolvimento.");
}

process.env.DATABASE_URL = testDatabaseUrl;
