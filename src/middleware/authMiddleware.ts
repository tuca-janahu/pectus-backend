import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, getUserById } from "../auth";

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers["authorization"] as string | undefined;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  const token = auth.slice("Bearer ".length);
  const payload = verifyAccessToken(token);
  if (!payload) return res.status(401).json({ error: "Token inválido" });

  const user = getUserById(payload.sub);
  if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

  res.locals.user = { id: user.id, email: user.email };
  next();
}
