import { Router } from "express";
import { authenticate, authorize } from "../../middleware/authMiddleware";
import { createAccount } from "./contas.controller";

const router = Router();
router.post("/", authenticate, authorize("ADMIN"), createAccount);

export default router;
