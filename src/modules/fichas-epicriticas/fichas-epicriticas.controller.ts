import type { Request, Response } from "express";
import { prisma } from "../../db/prisma";
import { mensagemDeErro } from "../../shared/error-message";
import { PrismaFichaEpicriticaRepository } from "./ficha-epicritica.repository";
import { FichaEpicriticaService } from "./ficha-epicritica.service";

const service = new FichaEpicriticaService(new PrismaFichaEpicriticaRepository(prisma));

function idDaRequisicao(req: Request) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new Error("Id inválido");
  return id;
}

function responderErro(res: Response, error: unknown, status = 400) {
  res.status(status).json({ error: mensagemDeErro(error) });
}

export async function criarFicha(req: Request, res: Response) {
  try {
    const ficha = await service.criar(req.body ?? {});
    res.status(201).json({ ficha });
  } catch (error) {
    responderErro(res, error);
  }
}

export async function listarFichas(req: Request, res: Response) {
  try {
    const fichas = await service.listar(req.query);
    res.json({ fichas });
  } catch (error) {
    responderErro(res, error);
  }
}

export async function buscarFicha(req: Request, res: Response) {
  try {
    const ficha = await service.buscarPorId(idDaRequisicao(req));
    res.json({ ficha });
  } catch (error) {
    responderErro(res, error, 404);
  }
}

export async function atualizarFicha(req: Request, res: Response) {
  try {
    const ficha = await service.atualizar(idDaRequisicao(req), req.body ?? {});
    res.json({ ficha });
  } catch (error) {
    responderErro(res, error);
  }
}

export async function reagendarFicha(req: Request, res: Response) {
  try {
    const ficha = await service.reagendar(idDaRequisicao(req), req.body ?? {});
    res.json({ ficha });
  } catch (error) {
    responderErro(res, error);
  }
}

export async function iniciarFicha(req: Request, res: Response) {
  try {
    const ficha = await service.iniciar(idDaRequisicao(req));
    res.json({ ficha });
  } catch (error) {
    responderErro(res, error);
  }
}

export async function concluirFicha(req: Request, res: Response) {
  try {
    const ficha = await service.concluir(idDaRequisicao(req));
    res.json({ ficha });
  } catch (error) {
    responderErro(res, error);
  }
}

export async function cancelarFicha(req: Request, res: Response) {
  try {
    const ficha = await service.cancelar(idDaRequisicao(req));
    res.json({ ficha });
  } catch (error) {
    responderErro(res, error);
  }
}
