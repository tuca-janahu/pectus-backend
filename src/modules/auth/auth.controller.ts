import type { NextFunction, Request, Response } from "express";

import { AuthService } from "./auth.service";
import type { ForgotPasswordService } from "./forgot-password.service";
import type { ResetPasswordService } from "./reset-password.service";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro interno.";
}

function contextoDe(req: Request) {
  return { ip: req.ip, userAgent: req.headers["user-agent"] };
}

export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly forgotPasswordService: ForgotPasswordService,
    private readonly resetPasswordService: ResetPasswordService,
  ) {}

  activate = async (req: Request, res: Response) => {
    try {
      const { token, password } = req.body ?? {};
      if (!token || !password) return res.status(400).json({ error: "Token ou senha ausentes" });
      const tokens = await this.authService.activate(token, password);
      return res.status(201).json(tokens);
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
      const tokens = await this.authService.login(email, password, contextoDe(req));
      return res.json(tokens);
    } catch (error) {
      return res.status(401).json({ error: errorMessage(error) });
    }
  };

  loginWithGoogle = async (req: Request, res: Response) => {
    const { code } = req.body ?? {};
    if (!code) {
      return res.status(400).json({ error: "Código de autorização ausente" });
    }

    try {
      const tokens = await this.authService.loginWithGoogle(code, contextoDe(req));
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
      const tokens = await this.authService.refresh(refreshToken);
      return res.json(tokens);
    } catch (error) {
      return res.status(401).json({ error: errorMessage(error) });
    }
  };

  logout = async (req: Request, res: Response) => {
    const { refreshToken } = req.body ?? {};
    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token ausente" });
    }

    await this.authService.logout(refreshToken);
    return res.status(204).end();
  };

  me = (_req: Request, res: Response, _next: NextFunction) => {
    return res.json(res.locals.user);
  };

  forgotPassword = async (req: Request, res: Response) => {
    const { email } = req.body ?? {};
    if (!email) return res.status(400).json({ error: "Email ausente" });
    try {
      await this.forgotPasswordService.execute(email);
    } catch (error) {
      console.error("Falha ao processar solicitacao de redefinição de senha", error);
    }
    return res.status(200).json({
      message: "Se este e-mail estiver cadastrado, enviaremos um link de redefinição de senha.",
    });
  };

  resetPassword = async (req: Request, res: Response) => {
    const { token, password } = req.body ?? {};
    if (!token || !password) return res.status(400).json({ error: "Token ou senha ausentes" });
    try {
      await this.resetPasswordService.execute(token, password);
      return res.status(204).end();
    } catch (error) {
      return res.status(400).json({ error: errorMessage(error) });
    }
  };
}
