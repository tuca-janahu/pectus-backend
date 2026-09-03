import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "../../../src/db/prisma";
import { RegisterService } from "../../../src/modules/contas/register.service";
import { PrismaContaRepository } from "../../../src/modules/contas/conta.repository";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL deve estar configurada no ambiente de teste.");
}

const testPrisma = createPrismaClient(databaseUrl);
const service = new RegisterService(new PrismaContaRepository(testPrisma));

describe("RegisterService", () => {
  beforeAll(async () => {
    await testPrisma.$connect();
  });

  afterEach(async () => {
    await testPrisma.telefone.deleteMany();
    await testPrisma.fichaEpicritica.deleteMany();
    await testPrisma.medico.deleteMany();
    await testPrisma.contaPapel.deleteMany();
    await testPrisma.conta.deleteMany();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("registra uma conta ADMIN sem perfil medico", async () => {
    const conta = await service.execute({
      nome: "Administradora",
      email: "admin@example.com",
      roles: ["ADMIN"],
    });

    expect(conta.email).toBe("admin@example.com");
    expect(conta.papeis.map(({ papel }) => papel)).toEqual(["ADMIN"]);
    expect(conta.medico).toBeNull();
  });

  it("registra uma conta ADMIN e MEDICO com CRM e telefones", async () => {
    const conta = await service.execute({
      nome: "Dra. Ana",
      email: "ana@example.com",
      roles: ["ADMIN", "MEDICO"],
      medico: {
        crm: "123456-BA",
        telefones: ["71999999999", "7133333333"],
      },
    });

    expect(conta.papeis.map(({ papel }) => papel).sort()).toEqual(["ADMIN", "MEDICO"]);
    expect(conta.medico?.crm).toBe("123456-BA");
    expect(conta.medico?.telefones).toHaveLength(2);
  });

  it("rejeita uma conta MEDICO sem perfil profissional", async () => {
    await expect(
      service.execute({
        nome: "Dra. Sem CRM",
        email: "sem-crm@example.com",
        roles: ["MEDICO"],
      }),
    ).rejects.toThrow("O perfil medico e obrigatorio para contas com o papel MEDICO.");

    expect(await testPrisma.conta.count()).toBe(0);
  });
});
