import bcrypt from "bcryptjs";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "../../../src/db/prisma";
import { authService } from "../../../src/modules/auth/auth.service";
import { PrismaContaRepository } from "../../../src/modules/contas/conta.repository";
import { RegisterService } from "../../../src/modules/contas/register.service";
import { UpdateContaService } from "../../../src/modules/contas/update-conta.service";
import { NoopMailer } from "../../../src/modules/email/noop-mailer";
import { PrismaLocalidadeRepository } from "../../../src/modules/localidades/localidade.repository";
import { PrismaLogRepository } from "../../../src/modules/logs/log.repository";
import { PrismaPacienteRepository } from "../../../src/modules/pacientes/paciente.repository";
import { CriarPacienteService } from "../../../src/modules/pacientes/paciente.service";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL deve estar configurada no ambiente de teste.");
}

const testPrisma = createPrismaClient(databaseUrl);
const logRepository = new PrismaLogRepository(testPrisma);
const contaRepository = new PrismaContaRepository(testPrisma);
const registerService = new RegisterService(contaRepository, new NoopMailer(), logRepository);
const updateContaService = new UpdateContaService(contaRepository, logRepository);
const localidadeRepository = new PrismaLocalidadeRepository(testPrisma);
const pacienteRepository = new PrismaPacienteRepository(testPrisma);
const criarPacienteService = new CriarPacienteService(pacienteRepository, localidadeRepository, logRepository);

async function criarContaComSenha(email: string, senha: string) {
  const senhaHash = await bcrypt.hash(senha, 12);
  return testPrisma.conta.create({
    data: {
      nome: "Ana",
      email,
      papeis: { create: [{ papel: "ADMIN" }] },
      identidades: { create: [{ provedor: "LOCAL", senhaHash }] },
    },
  });
}

describe("Logs de auditoria", () => {
  beforeAll(async () => {
    await testPrisma.$connect();
  });

  afterEach(async () => {
    await testPrisma.logAuditoria.deleteMany();
    await testPrisma.sessao.deleteMany();
    await testPrisma.telefone.deleteMany();
    await testPrisma.fichaEpicritica.deleteMany();
    await testPrisma.identidadeAuth.deleteMany();
    await testPrisma.medico.deleteMany();
    await testPrisma.tokenAtivacao.deleteMany();
    await testPrisma.contaPapel.deleteMany();
    await testPrisma.paciente.deleteMany();
    await testPrisma.conta.deleteMany();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("registra login com sucesso", async () => {
    await criarContaComSenha("ana@example.com", "senha-correta-123");

    await authService.login("ana@example.com", "senha-correta-123");

    const { items } = await logRepository.listar({ modulo: "AUTENTICACAO", limit: 50, offset: 0 });
    expect(items).toHaveLength(1);
    expect(items[0].tipo).toBe("LOGIN_SUCESSO");
    expect(items[0].ator?.email).toBe("ana@example.com");
  });

  it("registra login malsucedido por senha incorreta, distinguindo o motivo", async () => {
    await criarContaComSenha("ana@example.com", "senha-correta-123");

    await expect(authService.login("ana@example.com", "senha-errada")).rejects.toThrow("Credenciais inválidas");

    const { items } = await logRepository.listar({ modulo: "AUTENTICACAO", limit: 50, offset: 0 });
    expect(items).toHaveLength(1);
    expect(items[0].tipo).toBe("LOGIN_FALHA");
    expect(items[0].metadata).toMatchObject({ motivo: "senha_incorreta" });
    expect(items[0].atorId).not.toBeNull();
  });

  it("registra login malsucedido por email desconhecido, sem ator", async () => {
    await expect(authService.login("desconhecido@example.com", "qualquer-senha")).rejects.toThrow(
      "Credenciais inválidas",
    );

    const { items } = await logRepository.listar({ modulo: "AUTENTICACAO", limit: 50, offset: 0 });
    expect(items).toHaveLength(1);
    expect(items[0].tipo).toBe("LOGIN_FALHA");
    expect(items[0].metadata).toMatchObject({ motivo: "email_desconhecido" });
    expect(items[0].atorId).toBeNull();
  });

  it("registra criação de conta", async () => {
    await registerService.execute({ nome: "Bruno", email: "bruno@example.com", roles: ["ADMIN"] });

    const { items } = await logRepository.listar({ modulo: "USUARIOS", limit: 50, offset: 0 });
    expect(items).toHaveLength(1);
    expect(items[0].tipo).toBe("USUARIO_CRIADO");
  });

  it("registra ativação/desativação de conta pelo admin", async () => {
    await registerService.execute({ nome: "Bruno", email: "bruno@example.com", roles: ["ADMIN"] });
    const conta = await testPrisma.conta.findFirstOrThrow();

    await updateContaService.execute(conta.id, { ativo: false });
    await updateContaService.execute(conta.id, { ativo: true });

    const { items } = await logRepository.listar({ modulo: "USUARIOS", limit: 50, offset: 0 });
    const tipos = items.map((i) => i.tipo).sort();
    expect(tipos).toContain("USUARIO_DESATIVADO_ADMIN");
    expect(tipos).toContain("USUARIO_ATIVADO_ADMIN");
  });

  it("registra criação de paciente", async () => {
    await criarPacienteService.execute({
      nome: "Paciente Teste",
      dataNascimento: "1990-01-01",
      genero: "feminino",
    });

    const { items } = await logRepository.listar({ modulo: "PACIENTES", limit: 50, offset: 0 });
    expect(items).toHaveLength(1);
    expect(items[0].tipo).toBe("PACIENTE_CRIADO");
  });

  it("filtra por data e por busca livre", async () => {
    await registerService.execute({ nome: "Carlos Souza", email: "carlos@example.com", roles: ["ADMIN"] });
    await registerService.execute({ nome: "Daniela Lima", email: "daniela@example.com", roles: ["ADMIN"] });

    const porBusca = await logRepository.listar({ busca: "Carlos Souza", limit: 50, offset: 0 });
    expect(porBusca.items).toHaveLength(1);
    expect(porBusca.items[0].descricao).toContain("Carlos Souza");

    const futuro = new Date(Date.now() + 60_000);
    const porDataFutura = await logRepository.listar({ de: futuro, limit: 50, offset: 0 });
    expect(porDataFutura.items).toHaveLength(0);

    const passado = new Date(Date.now() - 60_000);
    const porDataPassada = await logRepository.listar({ de: passado, limit: 50, offset: 0 });
    expect(porDataPassada.total).toBe(2);
  });
});
