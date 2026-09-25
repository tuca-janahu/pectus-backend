import { Router } from "express";
import { authenticate, authorize } from "../../middleware/authMiddleware";
import { listLogs } from "./logs.controller";

const router = Router();
router.get("/", authenticate, authorize("ADMIN"), listLogs);

export default router;
