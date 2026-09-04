import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { authConfig } from "../../config/auth";
import { prisma } from "../../db/prisma";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export class AuthService {
  async activate(token: string, password: string) {
    const activation = await prisma.tokenAtivacao.findUnique({ where: { tokenHash: hash(token) }, include: { conta: true } });
    if (!activation || activation.usadoEm || activation.expiraEm <= new Date() || activation.conta.inativadoEm) throw new Error("Token de ativacao invalido ou expirado");
    const senhaHash = await bcrypt.hash(password, 12);
    await prisma.$transaction([
      prisma.identidadeAuth.upsert({ where: { contaId_provedor: { contaId: activation.contaId, provedor: "LOCAL" } }, create: { contaId: activation.contaId, provedor: "LOCAL", senhaHash }, update: { senhaHash } }),
      prisma.tokenAtivacao.update({ where: { id: activation.id }, data: { usadoEm: new Date() } }),
    ]);
  }

  async login(email: string, password: string) {
    const conta = await prisma.conta.findUnique({ where: { email: email.toLowerCase() }, include: { papeis: true, medico: true, identidades: { where: { provedor: "LOCAL" } } } });
    const identity = conta?.identidades[0];
    if (!conta || conta.inativadoEm || !identity?.senhaHash || !(await bcrypt.compare(password, identity.senhaHash))) throw new Error("Credenciais invalidas");
    return this.createSession(conta);
  }

  async refresh(refreshToken: string) {
    const session = await prisma.sessao.findFirst({ where: { refreshTokenHash: hash(refreshToken), revogadoEm: null, expiraEm: { gt: new Date() } }, include: { conta: { include: { papeis: true, medico: true } } } });
    if (!session || session.conta.inativadoEm) throw new Error("Refresh token invalido");
    await prisma.sessao.update({ where: { id: session.id }, data: { revogadoEm: new Date() } });
    return this.createSession(session.conta);
  }

  async logout(refreshToken: string) {
    await prisma.sessao.updateMany({ where: { refreshTokenHash: hash(refreshToken), revogadoEm: null }, data: { revogadoEm: new Date() } });
  }

  async authenticate(token: string) {
    try {
      const payload = jwt.verify(token, authConfig.jwtSecret);
      if (typeof payload === "string" || typeof payload.sub !== "string") return null;
      const conta = await prisma.conta.findUnique({ where: { id: Number(payload.sub) }, include: { papeis: true, medico: true } });
      if (!conta || conta.inativadoEm) return null;
      return this.publicConta(conta);
    } catch { return null; }
  }

  private publicConta(conta: { id: number; email: string; nome: string; papeis: { papel: string }[]; medico: { crm: string } | null }) {
    return {
      id: conta.id,
      email: conta.email,
      nome: conta.nome,
      roles: conta.papeis.map(({ papel }) => papel),
      medico: conta.medico ? { crm: conta.medico.crm } : null,
    };
  }

  private async createSession(conta: { id: number; email: string; nome: string; papeis: { papel: string }[]; medico: { crm: string } | null }) {
    const refreshToken = randomBytes(48).toString("base64url");
    const roles = conta.papeis.map(({ papel }) => papel);
    await prisma.sessao.create({ data: { contaId: conta.id, refreshTokenHash: hash(refreshToken), expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } });
    return { accessToken: jwt.sign({ sub: String(conta.id), roles }, authConfig.jwtSecret, { expiresIn: authConfig.accessExpiresIn }), refreshToken, conta: this.publicConta(conta) };
  }
}

export const authService = new AuthService();
