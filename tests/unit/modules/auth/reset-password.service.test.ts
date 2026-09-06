import { describe, expect, it } from "vitest";

import { ResetPasswordService } from "../../../../src/modules/auth/reset-password.service";
import type {
  ContaParaResetSenha,
  PasswordResetRepository,
  TokenResetSenhaValido,
} from "../../../../src/modules/auth/password-reset.repository";

class PasswordResetRepositoryFalso implements PasswordResetRepository {
  tokenValido: TokenResetSenhaValido | null = null;
  redefinicoes: { tokenId: number; contaId: number; senhaHash: string }[] = [];

  async buscarContaAtivaPorEmail(_email: string): Promise<ContaParaResetSenha | null> {
    throw new Error("nao usado neste teste");
  }

  async criarToken(): Promise<void> {
    throw new Error("nao usado neste teste");
  }

  async buscarTokenValidoPorHash(_tokenHash: string) {
    return this.tokenValido;
  }

  async redefinirSenha(input: { tokenId: number; contaId: number; senhaHash: string }) {
    this.redefinicoes.push(input);
  }
}

const TOKEN = "token-valido";
const FUTURO = new Date(Date.now() + 60 * 60 * 1000);
const PASSADO = new Date(Date.now() - 60 * 1000);

describe("ResetPasswordService", () => {
  it("redefine a senha quando o token e valido", async () => {
    const repository = new PasswordResetRepositoryFalso();
    repository.tokenValido = { id: 10, contaId: 1, usadoEm: null, expiraEm: FUTURO, contaInativa: false };
    const service = new ResetPasswordService(repository);

    await service.execute(TOKEN, "nova-senha-123");

    expect(repository.redefinicoes).toHaveLength(1);
    expect(repository.redefinicoes[0].contaId).toBe(1);
    expect(repository.redefinicoes[0].senhaHash).not.toBe("nova-senha-123");
    expect(repository.redefinicoes[0].senhaHash.startsWith("$2")).toBe(true);
  });

  it("rejeita token ja usado", async () => {
    const repository = new PasswordResetRepositoryFalso();
    repository.tokenValido = { id: 10, contaId: 1, usadoEm: new Date(), expiraEm: FUTURO, contaInativa: false };
    const service = new ResetPasswordService(repository);

    await expect(service.execute(TOKEN, "nova-senha-123")).rejects.toThrow(
      "Token de redefinicao invalido ou expirado",
    );
  });

  it("rejeita token expirado", async () => {
    const repository = new PasswordResetRepositoryFalso();
    repository.tokenValido = { id: 10, contaId: 1, usadoEm: null, expiraEm: PASSADO, contaInativa: false };
    const service = new ResetPasswordService(repository);

    await expect(service.execute(TOKEN, "nova-senha-123")).rejects.toThrow(
      "Token de redefinicao invalido ou expirado",
    );
  });

  it("rejeita conta inativa", async () => {
    const repository = new PasswordResetRepositoryFalso();
    repository.tokenValido = { id: 10, contaId: 1, usadoEm: null, expiraEm: FUTURO, contaInativa: true };
    const service = new ResetPasswordService(repository);

    await expect(service.execute(TOKEN, "nova-senha-123")).rejects.toThrow(
      "Token de redefinicao invalido ou expirado",
    );
  });

  it("rejeita token desconhecido", async () => {
    const repository = new PasswordResetRepositoryFalso();
    repository.tokenValido = null;
    const service = new ResetPasswordService(repository);

    await expect(service.execute(TOKEN, "nova-senha-123")).rejects.toThrow(
      "Token de redefinicao invalido ou expirado",
    );
  });
});
