import { Router } from "express";
import { ZodError } from "zod";
import { prisma } from "../../db/prisma";
import { authenticate, authorize } from "../../middleware/authMiddleware";
import { dashboardFiltroSchema } from "./dashboard.schema";
import { DashboardService } from "./dashboard.service";

const router = Router();
const service = new DashboardService(prisma);
router.use(authenticate, authorize("ADMIN", "MEDICO"));

router.get("/medicos", async (_req, res) => {
  try {
    const medicos = await service.listarMedicos();
    res.json({ medicos: medicos.map((item) => ({ id: item.id, nome: item.conta.nome })) });
  } catch {
    res.status(500).json({ error: "Não foi possível carregar os médicos" });
  }
});

router.get("/resumo", async (req, res) => {
  try {
    const filtro = dashboardFiltroSchema.parse(req.query);
    res.json(await service.resumo(filtro));
  } catch (error) {
    if (error instanceof ZodError) return res.status(400).json({ error: error.issues[0]?.message ?? "Filtro inválido" });
    res.status(500).json({ error: "Não foi possível carregar o dashboard" });
  }
});

export default router;
