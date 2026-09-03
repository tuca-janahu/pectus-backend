import { randomUUID } from "node:crypto";

import bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";

import { authConfig } from "../../config/auth";
import { prisma } from "../../db/prisma";
import { PrismaContaRepository } from "../contas/conta.repository";
import { RegisterService } from "../contas/register.service";
import type { RegisterInput } from "../contas/register.schema";

type User = { id: string; email: string; passwordHash: string };

export class AuthService {
  private readonly users = new Map<string, User>();
  private readonly refreshTokens = new Map<string, string>();

  constructor(private readonly registerService: RegisterService) {}

  async register(input: RegisterInput) {
    return this.registerService.execute(input);
  }

  async login(email: string, password: string) {
    const user = this.users.get(email);
    if (!user) throw new Error("Credenciais invalidas");

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) throw new Error("Credenciais invalidas");

    const accessToken = this.createAccessToken(user);
    const refreshToken = randomUUID();
    this.refreshTokens.set(refreshToken, user.id);

    return { accessToken, refreshToken };
  }

  async refreshTokensFor(refreshToken: string) {
    const userId = this.refreshTokens.get(refreshToken);
    if (!userId) throw new Error("Token de atualizacao invalido");

    this.refreshTokens.delete(refreshToken);
    const newRefreshToken = randomUUID();
    this.refreshTokens.set(newRefreshToken, userId);

    const user = this.findUserById(userId);
    if (!user) throw new Error("Usuario nao encontrado");

    return {
      accessToken: this.createAccessToken(user),
      refreshToken: newRefreshToken,
    };
  }

  logout(refreshToken: string) {
    return this.refreshTokens.delete(refreshToken);
  }

  getUserById(id: string) {
    return this.findUserById(id) ?? null;
  }

  verifyAccessToken(token: string) {
    try {
      const payload = jwt.verify(token, authConfig.jwtSecret);

      if (typeof payload === "string" || typeof payload.sub !== "string") {
        return null;
      }

      return {
        sub: payload.sub,
        email: typeof payload.email === "string" ? payload.email : undefined,
      };
    } catch {
      return null;
    }
  }

  private createAccessToken(user: User) {
    return jwt.sign(
      { sub: user.id, email: user.email },
      authConfig.jwtSecret,
      { expiresIn: authConfig.accessExpiresIn },
    );
  }

  private findUserById(id: string) {
    return Array.from(this.users.values()).find((user) => user.id === id);
  }
}

const registerService = new RegisterService(new PrismaContaRepository(prisma));

export const authService = new AuthService(registerService);
