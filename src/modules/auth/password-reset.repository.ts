import type { PrismaClient } from "../../generated/prisma/client";

export interface ContaParaResetSenha {
  id: number;
  nome: string;
  email: string;
}

export interface TokenResetSenhaValido {
  id: number;
  contaId: number;
  usadoEm: Date | null;
  expiraEm: Date;
  contaInativa: boolean;
}

export interface PasswordResetRepository {
  buscarContaAtivaPorEmail(email: string): Promise<ContaParaResetSenha | null>;
  criarToken(input: { contaId: number; tokenHash: string; expiraEm: Date }): Promise<void>;
  buscarTokenValidoPorHash(tokenHash: string): Promise<TokenResetSenhaValido | null>;
  redefinirSenha(input: { tokenId: number; contaId: number; senhaHash: string }): Promise<void>;
}

export class PrismaPasswordResetRepository implements PasswordResetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async buscarContaAtivaPorEmail(email: string) {
    const conta = await this.prisma.conta.findUnique({ where: { email } });
    if (!conta || conta.inativadoEm) return null;
    return { id: conta.id, nome: conta.nome, email: conta.email };
  }

  async criarToken({ contaId, tokenHash, expiraEm }: { contaId: number; tokenHash: string; expiraEm: Date }) {
    await this.prisma.tokenRedefinicaoSenha.create({ data: { contaId, tokenHash, expiraEm } });
  }

  async buscarTokenValidoPorHash(tokenHash: string) {
    const token = await this.prisma.tokenRedefinicaoSenha.findUnique({
      where: { tokenHash },
      include: { conta: true },
    });
    if (!token) return null;
    return {
      id: token.id,
      contaId: token.contaId,
      usadoEm: token.usadoEm,
      expiraEm: token.expiraEm,
      contaInativa: Boolean(token.conta.inativadoEm),
    };
  }

  async redefinirSenha({ tokenId, contaId, senhaHash }: { tokenId: number; contaId: number; senhaHash: string }) {
    await this.prisma.$transaction([
      this.prisma.identidadeAuth.upsert({
        where: { contaId_provedor: { contaId, provedor: "LOCAL" } },
        create: { contaId, provedor: "LOCAL", senhaHash },
        update: { senhaHash },
      }),
      this.prisma.tokenRedefinicaoSenha.update({ where: { id: tokenId }, data: { usadoEm: new Date() } }),
      this.prisma.sessao.updateMany({ where: { contaId, revogadoEm: null }, data: { revogadoEm: new Date() } }),
    ]);
  }
}
