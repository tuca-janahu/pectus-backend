import { Router } from "express";
import { authenticate, authorize } from "../../middleware/authMiddleware";
import { createAccount, listAccounts, updateAccount } from "./contas.controller";

const router = Router();
router.get("/", authenticate, authorize("ADMIN"), listAccounts);
router.post("/", authenticate, authorize("ADMIN"), createAccount);
router.patch("/:id", authenticate, authorize("ADMIN"), updateAccount);

export default router;
