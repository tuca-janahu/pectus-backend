import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "../../../src/db/prisma";
import { authService } from "../../../src/modules/auth/auth.service";
import { hashToken } from "../../../src/modules/auth/token-hash";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL deve estar configurada no ambiente de teste.");
}

const testPrisma = createPrismaClient(databaseUrl);

describe("Ativacao de conta", () => {
  beforeAll(async () => {
    await testPrisma.$connect();
  });

  afterEach(async () => {
    await testPrisma.logAuditoria.deleteMany();
    await testPrisma.sessao.deleteMany();
    await testPrisma.tokenAtivacao.deleteMany();
    await testPrisma.identidadeAuth.deleteMany();
    await testPrisma.contaPapel.deleteMany();
    await testPrisma.conta.deleteMany();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("cria uma sessao para a conta ativada, sem reutilizar a sessao existente", async () => {
    const seed = await testPrisma.conta.create({
      data: { nome: "Seed", email: "seed@example.com", papeis: { create: [{ papel: "ADMIN" }] } },
    });
    const novaConta = await testPrisma.conta.create({
      data: {
        nome: "Nova conta",
        email: "nova@example.com",
        papeis: { create: [{ papel: "MEDICO" }] },
        tokensAtivacao: {
          create: {
            tokenHash: hashToken("token-de-ativação"),
            expiraEm: new Date(Date.now() + 60_000),
          },
        },
      },
    });
    await testPrisma.sessao.create({
      data: {
        contaId: seed.id,
        refreshTokenHash: "sessao-seed",
        expiraEm: new Date(Date.now() + 60_000),
      },
    });

    const resultado = await authService.activate("token-de-ativação", "senha-segura-123");

    expect(resultado.conta).toMatchObject({ id: novaConta.id, email: "nova@example.com", roles: ["MEDICO"] });
    expect(resultado.accessToken).toBeTruthy();
    expect(resultado.refreshToken).toBeTruthy();
    expect(await authService.authenticate(resultado.accessToken)).toMatchObject({ id: novaConta.id });

    const sessoes = await testPrisma.sessao.findMany({ orderBy: { contaId: "asc" } });
    expect(sessoes.map(({ contaId }) => contaId)).toEqual([seed.id, novaConta.id]);
  });

  it("não permite reutilizar o token de ativação", async () => {
    await testPrisma.conta.create({
      data: {
        nome: "Nova conta",
        email: "nova@example.com",
        papeis: { create: [{ papel: "ADMIN" }] },
        tokensAtivacao: {
          create: {
            tokenHash: hashToken("token-de-uso-unico"),
            expiraEm: new Date(Date.now() + 60_000),
          },
        },
      },
    });

    await authService.activate("token-de-uso-unico", "senha-segura-123");

    await expect(authService.activate("token-de-uso-unico", "outra-senha-123")).rejects.toThrow(
      "Token de ativação inválido ou expirado",
    );
  });
});
