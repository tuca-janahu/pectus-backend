import bcrypt from "bcryptjs";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "../../../src/db/prisma";
import { authService } from "../../../src/modules/auth/auth.service";
import { ForgotPasswordService } from "../../../src/modules/auth/forgot-password.service";
import { PrismaPasswordResetRepository } from "../../../src/modules/auth/password-reset.repository";
import { ResetPasswordService } from "../../../src/modules/auth/reset-password.service";
import { hashToken } from "../../../src/modules/auth/token-hash";
import type {
  ActivationEmailInput,
  Mailer,
  PasswordResetEmailInput,
} from "../../../src/modules/email/mailer";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL deve estar configurada no ambiente de teste.");
}

const testPrisma = createPrismaClient(databaseUrl);
const passwordResetRepository = new PrismaPasswordResetRepository(testPrisma);

class MailerFalso implements Mailer {
  passwordResetEmailsSent: PasswordResetEmailInput[] = [];

  async sendActivationEmail(_input: ActivationEmailInput) {}

  async sendPasswordResetEmail(input: PasswordResetEmailInput) {
    this.passwordResetEmailsSent.push(input);
  }
}

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

function extrairToken(resetLink: string) {
  return new URL(resetLink).searchParams.get("token") ?? "";
}

describe("Fluxo de redefinição de senha", () => {
  beforeAll(async () => {
    await testPrisma.$connect();
  });

  afterEach(async () => {
    await testPrisma.logAuditoria.deleteMany();
    await testPrisma.sessao.deleteMany();
    await testPrisma.tokenRedefinicaoSenha.deleteMany();
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

  it("permite redefinir a senha e revoga sessoes ativas", async () => {
    const conta = await criarContaComSenha("ana@example.com", "senha-antiga-123");
    const sessao = await testPrisma.sessao.create({
      data: {
        contaId: conta.id,
        refreshTokenHash: "refresh-hash-de-teste",
        expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const mailer = new MailerFalso();
    const forgotPasswordService = new ForgotPasswordService(passwordResetRepository, mailer);
    await forgotPasswordService.execute("ana@example.com");

    expect(mailer.passwordResetEmailsSent).toHaveLength(1);
    const token = extrairToken(mailer.passwordResetEmailsSent[0].resetLink);

    const resetPasswordService = new ResetPasswordService(passwordResetRepository);
    await resetPasswordService.execute(token, "senha-nova-123");

    await expect(authService.login("ana@example.com", "senha-nova-123")).resolves.toBeDefined();
    await expect(authService.login("ana@example.com", "senha-antiga-123")).rejects.toThrow(
      "Credenciais inválidas",
    );

    const sessaoAtualizada = await testPrisma.sessao.findUniqueOrThrow({ where: { id: sessao.id } });
    expect(sessaoAtualizada.revogadoEm).not.toBeNull();
  });

  it("rejeita reutilizar o mesmo token de redefinição", async () => {
    await criarContaComSenha("ana@example.com", "senha-antiga-123");

    const mailer = new MailerFalso();
    const forgotPasswordService = new ForgotPasswordService(passwordResetRepository, mailer);
    await forgotPasswordService.execute("ana@example.com");
    const token = extrairToken(mailer.passwordResetEmailsSent[0].resetLink);

    const resetPasswordService = new ResetPasswordService(passwordResetRepository);
    await resetPasswordService.execute(token, "senha-nova-123");

    await expect(resetPasswordService.execute(token, "outra-senha-456")).rejects.toThrow(
      "Token de redefinição inválido ou expirado",
    );
  });

  it("rejeita um token de redefinição expirado", async () => {
    const conta = await criarContaComSenha("ana@example.com", "senha-antiga-123");
    const tokenBruto = "token-de-teste-expirado";
    await testPrisma.tokenRedefinicaoSenha.create({
      data: {
        contaId: conta.id,
        tokenHash: hashToken(tokenBruto),
        expiraEm: new Date(Date.now() - 60 * 1000),
      },
    });

    const resetPasswordService = new ResetPasswordService(passwordResetRepository);
    await expect(resetPasswordService.execute(tokenBruto, "senha-nova-123")).rejects.toThrow(
      "Token de redefinição inválido ou expirado",
    );
  });

  it("não cria token nem envia e-mail para um endereco não cadastrado", async () => {
    const mailer = new MailerFalso();
    const forgotPasswordService = new ForgotPasswordService(passwordResetRepository, mailer);

    await expect(forgotPasswordService.execute("não-existe@example.com")).resolves.toBeUndefined();

    expect(mailer.passwordResetEmailsSent).toHaveLength(0);
    expect(await testPrisma.tokenRedefinicaoSenha.count()).toBe(0);
  });
});
