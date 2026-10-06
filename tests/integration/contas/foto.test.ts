import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "../../../src/db/prisma";
import { PrismaContaRepository } from "../../../src/modules/contas/conta.repository";
import { UpdateContaFotoService } from "../../../src/modules/contas/conta-foto.service";
import { RegisterService } from "../../../src/modules/contas/register.service";
import { NoopMailer } from "../../../src/modules/email/noop-mailer";
import { PrismaLogRepository } from "../../../src/modules/logs/log.repository";
import { NoopStorage } from "../../../src/modules/storage";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL deve estar configurada no ambiente de teste.");
}

const testPrisma = createPrismaClient(databaseUrl);
const contaRepository = new PrismaContaRepository(testPrisma);
const logRepository = new PrismaLogRepository(testPrisma);
const storage = new NoopStorage();
const registerService = new RegisterService(contaRepository, new NoopMailer(), logRepository);
const updateContaFotoService = new UpdateContaFotoService(contaRepository, storage, logRepository);

describe("UpdateContaFotoService (integração)", () => {
  beforeAll(async () => {
    await testPrisma.$connect();
  });

  afterEach(async () => {
    await testPrisma.logAuditoria.deleteMany();
    await testPrisma.tokenAtivacao.deleteMany();
    await testPrisma.telefone.deleteMany();
    await testPrisma.fichaEpicritica.deleteMany();
    await testPrisma.medico.deleteMany();
    await testPrisma.contaPapel.deleteMany();
    await testPrisma.conta.deleteMany();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("envia a foto da própria conta, persiste a chave e registra o log de auditoria", async () => {
    const { conta } = await registerService.execute({
      nome: "Ana Beatriz",
      email: "ana.perfil@example.com",
      roles: ["ADMIN"],
    });

    const atualizado = await updateContaFotoService.execute(conta.id, {
      buffer: Buffer.from("fake-jpeg"),
      mimetype: "image/jpeg",
    });

    expect(atualizado.fotoChave).toMatch(/^contas\//);

    const persistido = await contaRepository.buscarPorId(conta.id);
    expect(persistido?.fotoChave).toBe(atualizado.fotoChave);

    const logs = await testPrisma.logAuditoria.findMany({ where: { tipo: "USUARIO_FOTO_ATUALIZADA" } });
    expect(logs).toHaveLength(1);
  });

  it("substitui a chave da foto antiga ao enviar uma nova para a mesma conta", async () => {
    const { conta } = await registerService.execute({
      nome: "Ana Beatriz",
      email: "ana.perfil2@example.com",
      roles: ["ADMIN"],
    });

    const primeira = await updateContaFotoService.execute(conta.id, {
      buffer: Buffer.from("fake-jpeg-1"),
      mimetype: "image/jpeg",
    });
    const segunda = await updateContaFotoService.execute(conta.id, {
      buffer: Buffer.from("fake-jpeg-2"),
      mimetype: "image/jpeg",
    });

    expect(segunda.fotoChave).not.toBe(primeira.fotoChave);
  });

  it("lança erro ao enviar foto para conta inexistente", async () => {
    await expect(
      updateContaFotoService.execute(999999, { buffer: Buffer.from("fake-jpeg"), mimetype: "image/jpeg" }),
    ).rejects.toThrow("Conta não encontrada");
  });
});
