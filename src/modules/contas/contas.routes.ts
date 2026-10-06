import { Router } from "express";
import { authenticate, authorize } from "../../middleware/authMiddleware";
import { uploadFoto } from "../../shared/foto-upload.middleware";
import { createAccount, listAccounts, updateAccount, uploadContaFoto } from "./contas.controller";

const router = Router();
router.get("/", authenticate, authorize("ADMIN"), listAccounts);
router.post("/", authenticate, authorize("ADMIN"), createAccount);
router.patch("/:id", authenticate, authorize("ADMIN"), updateAccount);
router.post("/me/foto", authenticate, uploadFoto, uploadContaFoto);

export default router;
