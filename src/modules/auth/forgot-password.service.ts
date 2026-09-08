import { randomBytes } from "node:crypto";
import { prisma } from "../../db/prisma";
import { mailer as defaultMailer } from "../email";
import type { Mailer } from "../email/mailer";
import { hashToken } from "./token-hash";
import { PrismaPasswordResetRepository, type PasswordResetRepository } from "./password-reset.repository";

export const RESET_PASSWORD_TOKEN_TTL_MS = 60 * 60 * 1000;

export class ForgotPasswordService {
  constructor(
    private readonly repository: PasswordResetRepository,
    private readonly mailer: Mailer,
  ) {}

  async execute(rawEmail: string): Promise<void> {
    const email = rawEmail.trim().toLowerCase();
    const resetToken = randomBytes(32).toString("hex");
    const tokenHash = hashToken(resetToken);
    const expiraEm = new Date(Date.now() + RESET_PASSWORD_TOKEN_TTL_MS);

    const conta = await this.repository.buscarContaAtivaPorEmail(email);
    if (!conta) return;

    await this.repository.criarToken({ contaId: conta.id, tokenHash, expiraEm });

    const resetLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/redefinir-senha?token=${resetToken}`;
    await this.mailer
      .sendPasswordResetEmail({ to: conta.email, nome: conta.nome, resetLink, expiresAt: expiraEm })
      .catch((error) => {
        console.error("Falha ao enviar e-mail de redefinição de senha", error);
      });
  }
}

export const forgotPasswordService = new ForgotPasswordService(
  new PrismaPasswordResetRepository(prisma),
  defaultMailer,
);
