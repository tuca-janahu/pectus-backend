import bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { randomUUID } from "crypto";

type User = { id: string; email: string; passwordHash: string };

const users = new Map<string, User>();
const refreshTokens = new Map<string, string>();

//Lembrar de transformar JWT em Váriavel de ambiente!
const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";
const ACCESS_EXPIRES = process.env.ACCESS_EXPIRES || "15m";
const REFRESH_EXPIRES = process.env.REFRESH_EXPIRES || "7d";

export async function register(email: string, password: string) {
  if (users.has(email)) {
    throw new Error("User already exists");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const id = randomUUID();
  const user: User = { id, email, passwordHash };
  users.set(email, user);
  return { id: user.id, email: user.email };
}

export async function login(email: string, password: string) {
  const user = users.get(email);
  if (!user) throw new Error("Credenciais inválidas");

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) throw new Error("Credenciais inválidas");

  const accessToken = jwt.sign(
    { sub: user.id, email: user.email },
    JWT_SECRET as jwt.Secret,
    {
      expiresIn: ACCESS_EXPIRES as jwt.SignOptions["expiresIn"],
    }
  );

  const refreshToken = randomUUID();
  refreshTokens.set(refreshToken, user.id);

  return { accessToken, refreshToken };
}

export async function refreshTokensFor(refreshToken: string) {
  const userId = refreshTokens.get(refreshToken);
  if (!userId) throw new Error("Token de atualização inválido");

  refreshTokens.delete(refreshToken);
  const newRefresh = randomUUID();
  refreshTokens.set(newRefresh, userId);

  const user = Array.from(users.values()).find((u) => u.id === userId);
  if (!user) throw new Error("Usuário não encontrado");

  const accessToken = jwt.sign(
    { sub: user.id, email: user.email },
    JWT_SECRET as jwt.Secret,
    {
      expiresIn: ACCESS_EXPIRES as jwt.SignOptions["expiresIn"],
    }
  );

  return { accessToken, refreshToken: newRefresh };
}

export function revokeRefreshToken(refreshToken: string) {
  return refreshTokens.delete(refreshToken);
}

export function getUserById(id: string) {
  return Array.from(users.values()).find((u) => u.id === id) || null;
}

export function verifyAccessToken(token: string) {
  try {
    const payload = jwt.verify(token, JWT_SECRET as jwt.Secret) as any;
    return payload as { sub: string; email: string; iat?: number; exp?: number };
  } catch (err) {
    return null;
  }
}
