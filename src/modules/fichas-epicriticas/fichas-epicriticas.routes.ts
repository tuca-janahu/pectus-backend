import { Router } from "express";
import { authenticate, authorize } from "../../middleware/authMiddleware";
import {
  atualizarFicha,
  buscarFicha,
  cancelarFicha,
  concluirFicha,
  criarFicha,
  iniciarFicha,
  listarFichas,
  reagendarFicha,
} from "./fichas-epicriticas.controller";

const router = Router();
router.use(authenticate, authorize("ADMIN", "MEDICO"));
router.get("/", listarFichas);
router.post("/", criarFicha);
router.get("/:id", buscarFicha);
router.patch("/:id", atualizarFicha);
router.patch("/:id/agendamento", reagendarFicha);
router.post("/:id/iniciar", iniciarFicha);
router.post("/:id/concluir", concluirFicha);
router.post("/:id/cancelar", cancelarFicha);

export default router;
