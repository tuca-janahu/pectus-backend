import type { NextFunction, Request, Response } from "express";

import { AuthService } from "./auth.service";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro interno.";
}

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register = async (req: Request, res: Response) => {
    try {
      const conta = await this.authService.register(req.body ?? {});
      res.status(201).json(conta);
    } catch (error) {
      res.status(400).json({ error: errorMessage(error) });
    }
  };

  login = async (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email ou senha ausentes" });
    }

    try {
      const tokens = await this.authService.login(email, password);
      return res.json(tokens);
    } catch (error) {
      return res.status(401).json({ error: errorMessage(error) });
    }
  };

  refresh = async (req: Request, res: Response) => {
    const { refreshToken } = req.body ?? {};
    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token ausente" });
    }

    try {
      const tokens = await this.authService.refreshTokensFor(refreshToken);
      return res.json(tokens);
    } catch (error) {
      return res.status(401).json({ error: errorMessage(error) });
    }
  };

  logout = (req: Request, res: Response) => {
    const { refreshToken } = req.body ?? {};
    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token ausente" });
    }

    this.authService.logout(refreshToken);
    return res.status(204).end();
  };

  me = (_req: Request, res: Response, _next: NextFunction) => {
    return res.json(res.locals.user);
  };
}
