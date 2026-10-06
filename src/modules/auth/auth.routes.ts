import { Router } from "express";

import { prisma } from "../../db/prisma";
import { authenticate } from "../../middleware/authMiddleware";
import { PrismaContaRepository } from "../contas/conta.repository";
import { storage } from "../storage";
import { AuthController } from "./auth.controller";
import { authService } from "./auth.service";
import { forgotPasswordService } from "./forgot-password.service";
import { resetPasswordService } from "./reset-password.service";

const router = Router();
const contaRepository = new PrismaContaRepository(prisma);
const authController = new AuthController(
  authService,
  forgotPasswordService,
  resetPasswordService,
  contaRepository,
  storage,
);

router.post("/activate", authController.activate);
router.post("/login", authController.login);
router.post("/google", authController.loginWithGoogle);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.get("/me", authenticate, authController.me);

export default router;
