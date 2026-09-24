import type { Request, Response } from "express";
import { prisma } from "../../db/prisma";
import { PrismaLocalidadeRepository } from "./localidade.repository";
import { LocalidadeService } from "./localidade.service";

const localidadeRepository = new PrismaLocalidadeRepository(prisma);
const localidadeService = new LocalidadeService(localidadeRepository);

export async function listEstados(_req: Request, res: Response) {
  const estados = await localidadeService.listarEstados();
  res.json({ estados });
}

export async function listMunicipios(req: Request, res: Response) {
  const codigo = Number(req.params.codigo);
  if (!Number.isInteger(codigo)) return res.status(400).json({ error: "Código de estado inválido" });
  const municipios = await localidadeService.listarMunicipios(codigo);
  res.json({ municipios });
}

export async function updateMunicipio(req: Request, res: Response) {
  const codigo = Number(req.params.codigo);
  if (!Number.isInteger(codigo)) return res.status(400).json({ error: "Código de município inválido" });
  try {
    const municipio = await localidadeService.atualizarMunicipio(codigo, req.body ?? {});
    res.json({ municipio });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao atualizar município" });
  }
}
