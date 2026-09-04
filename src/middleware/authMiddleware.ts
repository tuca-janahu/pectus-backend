import type { NextFunction, Request, Response } from "express";
import { authService } from "../modules/auth/auth.service";

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return res.status(401).json({ error: "Token nao fornecido" });
  const user = await authService.authenticate(authorization.slice(7));
  if (!user) return res.status(401).json({ error: "Token invalido" });
  res.locals.user = user;
  next();
}

export function authorize(...roles: string[]) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user as { roles?: string[] } | undefined;
    if (!user?.roles?.some((role) => roles.includes(role))) return res.status(403).json({ error: "FORBIDDEN" });
    next();
  };
}
