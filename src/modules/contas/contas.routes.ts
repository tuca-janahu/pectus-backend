import { Router } from "express";
import { authenticate, authorize } from "../../middleware/authMiddleware";
import { uploadFoto } from "../../shared/foto-upload.middleware";
import { createAccount, listAccounts, updateAccount, updateNotificacao, uploadContaFoto } from "./contas.controller";

const router = Router();
router.get("/", authenticate, authorize("ADMIN"), listAccounts);
router.post("/", authenticate, authorize("ADMIN"), createAccount);
router.patch("/:id", authenticate, authorize("ADMIN"), updateAccount);
router.post("/me/foto", authenticate, uploadFoto, uploadContaFoto);
router.patch("/me/notificacao", authenticate, updateNotificacao);

export default router;
