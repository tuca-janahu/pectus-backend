import { Router } from "express";
import { authenticate, authorize } from "../../middleware/authMiddleware";
import { listEstados, listMunicipios, updateMunicipio } from "./localidades.controller";

const router = Router();
router.get("/estados", authenticate, listEstados);
router.get("/estados/:codigo/municipios", authenticate, listMunicipios);
router.patch("/municipios/:codigo", authenticate, authorize("ADMIN"), updateMunicipio);

export default router;
