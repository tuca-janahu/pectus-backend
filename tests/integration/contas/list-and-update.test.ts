import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "../../../src/db/prisma";
import { PrismaContaRepository } from "../../../src/modules/contas/conta.repository";
import { RegisterService } from "../../../src/modules/contas/register.service";
import { UpdateContaService } from "../../../src/modules/contas/update-conta.service";
import { NoopMailer } from "../../../src/modules/email/noop-mailer";
import { PrismaLogRepository } from "../../../src/modules/logs/log.repository";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL deve estar configurada no ambiente de teste.");
}

const testPrisma = createPrismaClient(databaseUrl);
const contaRepository = new PrismaContaRepository(testPrisma);
const logRepository = new PrismaLogRepository(testPrisma);
const registerService = new RegisterService(contaRepository, new NoopMailer(), logRepository);
const updateContaService = new UpdateContaService(contaRepository, logRepository);

describe("Listagem e atualizacao de contas", () => {
  beforeAll(async () => {
    await testPrisma.$connect();
  });

  afterEach(async () => {
    await testPrisma.logAuditoria.deleteMany();
    await testPrisma.tokenAtivacao.deleteMany();
    await testPrisma.identidadeAuth.deleteMany();
    await testPrisma.telefone.deleteMany();
    await testPrisma.fichaEpicritica.deleteMany();
    await testPrisma.medico.deleteMany();
    await testPrisma.contaPapel.deleteMany();
    await testPrisma.conta.deleteMany();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("lista contas com status pendente (sem identidade LOCAL ainda)", async () => {
    await registerService.execute({ nome: "Ana", email: "ana@example.com", roles: ["ADMIN"] });

    const contas = await contaRepository.listar();

    expect(contas).toHaveLength(1);
    expect(contas[0].ativada).toBe(false);
    expect(contas[0].inativadoEm).toBeNull();
  });

  it("lista contas com identidade LOCAL como ativada", async () => {
    await registerService.execute({ nome: "Ana", email: "ana@example.com", roles: ["ADMIN"] });
    const conta = await testPrisma.conta.findFirstOrThrow();
    await testPrisma.identidadeAuth.create({
      data: { contaId: conta.id, provedor: "LOCAL", senhaHash: "hash-fake" },
    });

    const contas = await contaRepository.listar();

    expect(contas[0].ativada).toBe(true);
  });

  it("atualiza nome e desativa uma conta", async () => {
    await registerService.execute({ nome: "Ana", email: "ana@example.com", roles: ["ADMIN"] });
    const conta = await testPrisma.conta.findFirstOrThrow();

    const atualizada = await updateContaService.execute(conta.id, { nome: "Ana Beatriz", ativo: false });

    expect(atualizada.nome).toBe("Ana Beatriz");
    expect(atualizada.inativadoEm).not.toBeNull();
  });

  it("adiciona o papel MEDICO exigindo crm", async () => {
    await registerService.execute({ nome: "Ana", email: "ana@example.com", roles: ["ADMIN"] });
    const conta = await testPrisma.conta.findFirstOrThrow();

    await expect(updateContaService.execute(conta.id, { roles: ["ADMIN", "MEDICO"] })).rejects.toThrow(
      "CRM e obrigatorio para adicionar o papel MEDICO",
    );

    const atualizada = await updateContaService.execute(conta.id, {
      roles: ["ADMIN", "MEDICO"],
      crm: "123456-ba",
    });

    expect(atualizada.papeis.map((p) => p.papel).sort()).toEqual(["ADMIN", "MEDICO"]);
    expect(atualizada.medico?.crm).toBe("123456-BA");
  });

  it("remove um papel sem apagar o perfil medico existente", async () => {
    await registerService.execute({
      nome: "Dra. Ana",
      email: "ana@example.com",
      roles: ["ADMIN", "MEDICO"],
      medico: { crm: "123456-BA", telefones: [] },
    });
    const conta = await testPrisma.conta.findFirstOrThrow();

    const atualizada = await updateContaService.execute(conta.id, { roles: ["MEDICO"] });

    expect(atualizada.papeis.map((p) => p.papel)).toEqual(["MEDICO"]);
    expect(atualizada.medico?.crm).toBe("123456-BA");
  });
});
