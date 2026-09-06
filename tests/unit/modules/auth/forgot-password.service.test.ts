import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { ForgotPasswordService } from "../../../../src/modules/auth/forgot-password.service";
import type {
  ContaParaResetSenha,
  PasswordResetRepository,
  TokenResetSenhaValido,
} from "../../../../src/modules/auth/password-reset.repository";
import type {
  ActivationEmailInput,
  Mailer,
  PasswordResetEmailInput,
} from "../../../../src/modules/email/mailer";

class PasswordResetRepositoryFalso implements PasswordResetRepository {
  contaExistente: ContaParaResetSenha | null = null;
  tokensCriados: { contaId: number; tokenHash: string; expiraEm: Date }[] = [];

  async buscarContaAtivaPorEmail(_email: string) {
    return this.contaExistente;
  }

  async criarToken(input: { contaId: number; tokenHash: string; expiraEm: Date }) {
    this.tokensCriados.push(input);
  }

  async buscarTokenValidoPorHash(_tokenHash: string): Promise<TokenResetSenhaValido | null> {
    throw new Error("nao usado neste teste");
  }

  async redefinirSenha(): Promise<void> {
    throw new Error("nao usado neste teste");
  }
}

class MailerFalso implements Mailer {
  passwordResetEmailsSent: PasswordResetEmailInput[] = [];

  async sendActivationEmail(_input: ActivationEmailInput) {}

  async sendPasswordResetEmail(input: PasswordResetEmailInput) {
    this.passwordResetEmailsSent.push(input);
  }
}

class MailerQueFalha implements Mailer {
  async sendActivationEmail(): Promise<void> {}

  async sendPasswordResetEmail(): Promise<void> {
    throw new Error("Resend indisponivel");
  }
}

describe("ForgotPasswordService", () => {
  it("gera token e envia e-mail quando a conta existe e esta ativa", async () => {
    const repository = new PasswordResetRepositoryFalso();
    repository.contaExistente = { id: 1, nome: "Ana", email: "ana@example.com" };
    const mailer = new MailerFalso();
    const service = new ForgotPasswordService(repository, mailer);

    await service.execute("ana@example.com");

    expect(repository.tokensCriados).toHaveLength(1);
    expect(mailer.passwordResetEmailsSent).toHaveLength(1);

    const resetLink = mailer.passwordResetEmailsSent[0].resetLink;
    const token = new URL(resetLink).searchParams.get("token") ?? "";
    const tokenHash = createHash("sha256").update(token).digest("hex");
    expect(tokenHash).toBe(repository.tokensCriados[0].tokenHash);
  });

  it("nao cria token nem envia e-mail quando a conta nao existe, e nao lanca erro", async () => {
    const repository = new PasswordResetRepositoryFalso();
    repository.contaExistente = null;
    const mailer = new MailerFalso();
    const service = new ForgotPasswordService(repository, mailer);

    await expect(service.execute("desconhecido@example.com")).resolves.toBeUndefined();

    expect(repository.tokensCriados).toHaveLength(0);
    expect(mailer.passwordResetEmailsSent).toHaveLength(0);
  });

  it("nao lanca erro quando o mailer falha (best-effort)", async () => {
    const repository = new PasswordResetRepositoryFalso();
    repository.contaExistente = { id: 1, nome: "Ana", email: "ana@example.com" };
    const service = new ForgotPasswordService(repository, new MailerQueFalha());

    await expect(service.execute("ana@example.com")).resolves.toBeUndefined();
    expect(repository.tokensCriados).toHaveLength(1);
  });
});
