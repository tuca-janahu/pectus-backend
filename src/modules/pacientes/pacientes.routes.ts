import { Router } from "express";
import { authenticate, authorize } from "../../middleware/authMiddleware";
import { uploadFotoPaciente } from "./foto-upload.middleware";
import { createPaciente, enviarFotoPaciente, getPaciente, listPacientes, updatePaciente } from "./pacientes.controller";

const router = Router();
router.get("/", authenticate, authorize("ADMIN", "MEDICO"), listPacientes);
router.post("/", authenticate, authorize("ADMIN", "MEDICO"), createPaciente);
router.get("/:id", authenticate, authorize("ADMIN", "MEDICO"), getPaciente);
router.patch("/:id", authenticate, authorize("ADMIN", "MEDICO"), updatePaciente);
router.post("/:id/foto", authenticate, authorize("ADMIN", "MEDICO"), uploadFotoPaciente, enviarFotoPaciente);

export default router;
