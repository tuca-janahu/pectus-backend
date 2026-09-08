import { createHash, randomBytes } from "node:crypto";
import { registerSchema, type RegisterInput } from "./register.schema";
import type { ContaRepository } from "./conta.repository";
import type { Mailer } from "../email/mailer";

const ACTIVATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export class RegisterService {
  constructor(
    private readonly contaRepository: ContaRepository,
    private readonly mailer: Mailer,
  ) {}

  async execute(input: RegisterInput) {
    const data = registerSchema.parse(input);
    const activationToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(activationToken).digest("hex");
    const expiraEm = new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS);
    const conta = await this.contaRepository.create(data, { tokenHash, expiraEm });

    const activationLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/ativar-conta?token=${activationToken}`;
    await this.mailer
      .sendActivationEmail({ to: conta.email, nome: conta.nome, activationLink, expiresAt: expiraEm })
      .catch((error) => {
        console.error("Falha ao enviar e-mail de ativação de conta", error);
      });

    return { conta, activationToken, activationExpiresAt: expiraEm };
  }
}
