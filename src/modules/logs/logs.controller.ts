import type { Request, Response } from "express";
import { mensagemDeErro } from "../../shared/error-message";
import { listLogsSchema } from "./list-logs.schema";
import { logRepository } from "./log.repository";

export async function listLogs(req: Request, res: Response) {
  try {
    const filtro = listLogsSchema.parse(req.query);
    const resultado = await logRepository.listar(filtro);
    res.json(resultado);
  } catch (error) {
    res.status(400).json({ error: mensagemDeErro(error) });
  }
}
