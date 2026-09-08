import bcrypt from "bcryptjs";
import { prisma } from "../../db/prisma";
import { hashToken } from "./token-hash";
import { PrismaPasswordResetRepository, type PasswordResetRepository } from "./password-reset.repository";

export class ResetPasswordService {
  constructor(private readonly repository: PasswordResetRepository) {}

  async execute(token: string, password: string): Promise<void> {
    const registro = await this.repository.buscarTokenValidoPorHash(hashToken(token));
    if (!registro || registro.usadoEm || registro.expiraEm <= new Date() || registro.contaInativa) {
      throw new Error("Token de redefinição invalido ou expirado");
    }
    const senhaHash = await bcrypt.hash(password, 12);
    await this.repository.redefinirSenha({ tokenId: registro.id, contaId: registro.contaId, senhaHash });
  }
}

export const resetPasswordService = new ResetPasswordService(new PrismaPasswordResetRepository(prisma));
