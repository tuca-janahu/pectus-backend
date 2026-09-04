import { registerSchema, type RegisterInput } from "./register.schema";
import type { ContaRepository } from "./conta.repository";

export class RegisterService {
  constructor(private readonly contaRepository: ContaRepository) {}

  async execute(input: RegisterInput) {
    const data = registerSchema.parse(input);
    const activationToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(activationToken).digest("hex");
    const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const conta = await this.contaRepository.create(data, { tokenHash, expiraEm });

    return { conta, activationToken, activationExpiresAt: expiraEm };
  }
}
import { createHash, randomBytes } from "node:crypto";
