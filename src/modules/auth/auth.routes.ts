import express from "express";
import {
  register,
  login,
  refreshTokensFor,
  revokeRefreshToken,
  getUserById,
} from "../../config/auth";
import { authenticate } from "../../middleware/authMiddleware";

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const conta = await register(req.body ?? {});
    res.status(201).json(conta);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email ou senha ausentes" });

  try {
    const tokens = await login(email, password);
    res.json(tokens);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: "Refresh token ausente" });

  try {
    const tokens = await refreshTokensFor(refreshToken);
    res.json(tokens);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

router.post("/logout", (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: "Refresh token ausente" });
  revokeRefreshToken(refreshToken);
  res.status(204).end();
});

router.get("/me", authenticate, (req, res) => {
  res.json(res.locals.user);
});

export default router;
