import { Router } from "express";

import { authenticate } from "../../middleware/authMiddleware";
import { AuthController } from "./auth.controller";
import { authService } from "./auth.service";

const router = Router();
const authController = new AuthController(authService);

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.get("/me", authenticate, authController.me);

export default router;
