import type { Request, Response } from "express";
import { listLogsSchema } from "./list-logs.schema";
import { logRepository } from "./log.repository";

export async function listLogs(req: Request, res: Response) {
  try {
    const filtro = listLogsSchema.parse(req.query);
    const resultado = await logRepository.listar(filtro);
    res.json(resultado);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao listar logs" });
  }
}
