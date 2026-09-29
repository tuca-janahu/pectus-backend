import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "../../../src/db/prisma";
import { PrismaLocalidadeRepository } from "../../../src/modules/localidades/localidade.repository";
import { PrismaPacienteRepository } from "../../../src/modules/pacientes/paciente.repository";
import {
  AtualizarPacienteService,
  CriarPacienteService,
  EnviarFotoPacienteService,
} from "../../../src/modules/pacientes/paciente.service";
import { ensureLocalidadesFixture, FIXTURE_MUNICIPIO_BELEM } from "../../setup/localidades-fixture";
import { PrismaLogRepository } from "../../../src/modules/logs/log.repository";
import { NoopStorage } from "../../../src/modules/storage";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL deve estar configurada no ambiente de teste.");
}

const testPrisma = createPrismaClient(databaseUrl);
const localidadeRepository = new PrismaLocalidadeRepository(testPrisma);
const pacienteRepository = new PrismaPacienteRepository(testPrisma);
const logRepository = new PrismaLogRepository(testPrisma);
const storage = new NoopStorage();
const criarPacienteService = new CriarPacienteService(pacienteRepository, localidadeRepository, logRepository);
const atualizarPacienteService = new AtualizarPacienteService(pacienteRepository, localidadeRepository);
const enviarFotoPacienteService = new EnviarFotoPacienteService(pacienteRepository, storage, logRepository);

describe("Pacientes", () => {
  beforeAll(async () => {
    await testPrisma.$connect();
    await ensureLocalidadesFixture(testPrisma);
  });

  afterEach(async () => {
    await testPrisma.logAuditoria.deleteMany();
    await testPrisma.telefone.deleteMany({ where: { pacienteId: { not: null } } });
    await testPrisma.paciente.deleteMany();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("cria um paciente com município e telefones", async () => {
    const paciente = await criarPacienteService.execute({
      nome: "Ana Beatriz",
      dataNascimento: "1990-05-10",
      genero: "feminino",
      municipioId: FIXTURE_MUNICIPIO_BELEM.codigo,
      telefones: ["91999999999"],
    });

    expect(paciente.municipio?.codigo).toBe(FIXTURE_MUNICIPIO_BELEM.codigo);
    expect(paciente.municipio?.estado.sigla).toBe("PA");
    expect(paciente.telefones).toEqual([{ telefone: "91999999999" }]);
  });

  it("rejeita municipioId inválido", async () => {
    await expect(
      criarPacienteService.execute({
        nome: "Ana Beatriz",
        dataNascimento: "1990-05-10",
        genero: "feminino",
        municipioId: 999999,
      }),
    ).rejects.toThrow("Município inválido");

    expect(await testPrisma.paciente.count()).toBe(0);
  });

  it("atualiza nome e desativa um paciente", async () => {
    const paciente = await criarPacienteService.execute({
      nome: "Ana Beatriz",
      dataNascimento: "1990-05-10",
      genero: "feminino",
    });

    const atualizado = await atualizarPacienteService.execute(paciente.id, {
      nome: "Ana Beatriz Souza",
      ativo: false,
    });

    expect(atualizado.nome).toBe("Ana Beatriz Souza");
    expect(atualizado.inativadoEm).not.toBeNull();
  });

  it("não apaga os telefones existentes quando a atualização não menciona telefones", async () => {
    const paciente = await criarPacienteService.execute({
      nome: "Ana Beatriz",
      dataNascimento: "1990-05-10",
      genero: "feminino",
      telefones: ["91988887777"],
    });

    const atualizado = await atualizarPacienteService.execute(paciente.id, { nome: "Ana Beatriz Souza" });

    expect(atualizado.telefones).toEqual([{ telefone: "91988887777" }]);
  });

  it("substitui os telefones quando a atualização envia uma nova lista", async () => {
    const paciente = await criarPacienteService.execute({
      nome: "Ana Beatriz",
      dataNascimento: "1990-05-10",
      genero: "feminino",
      telefones: ["91988887777"],
    });

    const atualizado = await atualizarPacienteService.execute(paciente.id, { telefones: ["91977776666"] });

    expect(atualizado.telefones).toEqual([{ telefone: "91977776666" }]);
  });

  it("envia a foto do paciente, persiste a chave e registra o log de auditoria", async () => {
    const paciente = await criarPacienteService.execute({
      nome: "Ana Beatriz",
      dataNascimento: "1990-05-10",
      genero: "feminino",
    });

    const atualizado = await enviarFotoPacienteService.execute(paciente.id, {
      buffer: Buffer.from("fake-jpeg"),
      mimetype: "image/jpeg",
    });

    expect(atualizado.fotoChave).toMatch(/^pacientes\//);

    const persistido = await testPrisma.paciente.findUnique({ where: { id: paciente.id } });
    expect(persistido?.fotoChave).toBe(atualizado.fotoChave);

    const logs = await testPrisma.logAuditoria.findMany({ where: { tipo: "PACIENTE_FOTO_ATUALIZADA" } });
    expect(logs).toHaveLength(1);
  });

  it("substitui a chave da foto antiga ao enviar uma nova para o mesmo paciente", async () => {
    const paciente = await criarPacienteService.execute({
      nome: "Ana Beatriz",
      dataNascimento: "1990-05-10",
      genero: "feminino",
    });

    const primeira = await enviarFotoPacienteService.execute(paciente.id, {
      buffer: Buffer.from("fake-jpeg-1"),
      mimetype: "image/jpeg",
    });
    const segunda = await enviarFotoPacienteService.execute(paciente.id, {
      buffer: Buffer.from("fake-jpeg-2"),
      mimetype: "image/jpeg",
    });

    expect(segunda.fotoChave).not.toBe(primeira.fotoChave);
  });

  it("lança erro ao enviar foto para paciente inexistente", async () => {
    await expect(
      enviarFotoPacienteService.execute(999999, { buffer: Buffer.from("fake-jpeg"), mimetype: "image/jpeg" }),
    ).rejects.toThrow("Paciente não encontrado");
  });
});
