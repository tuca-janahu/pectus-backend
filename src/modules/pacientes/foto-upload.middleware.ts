import multer from "multer";
import type { NextFunction, Request, Response } from "express";

const MAX_FOTO_BYTES = 8 * 1024 * 1024;
const MIME_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];

const uploadMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FOTO_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!MIME_PERMITIDOS.includes(file.mimetype)) {
      return cb(new Error("Formato de imagem não suportado. Use JPEG, PNG ou WEBP."));
    }
    cb(null, true);
  },
}).single("foto");

export function uploadFotoPaciente(req: Request, res: Response, next: NextFunction) {
  uploadMulter(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message ?? "Erro ao processar arquivo." });
    next();
  });
}
