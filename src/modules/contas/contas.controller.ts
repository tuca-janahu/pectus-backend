import type { Request, Response } from "express";
import { prisma } from "../../db/prisma";
import { mailer } from "../email";
import { logRepository } from "../logs/log.repository";
import { PrismaContaRepository } from "./conta.repository";
import { RegisterService } from "./register.service";
import { UpdateContaService } from "./update-conta.service";

const contaRepository = new PrismaContaRepository(prisma);
const registerService = new RegisterService(contaRepository, mailer, logRepository);
const updateContaService = new UpdateContaService(contaRepository, logRepository);

function atorIdDe(res: Response): number | undefined {
  const user = res.locals.user as { id?: number } | undefined;
  return user?.id;
}

export async function createAccount(req: Request, res: Response) {
  try {
    const result = await registerService.execute(req.body ?? {}, atorIdDe(res));
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao criar conta" });
  }
}

export async function listAccounts(_req: Request, res: Response) {
  const contas = await contaRepository.listar();
  res.json({ contas });
}

export async function updateAccount(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Id invalido" });
  }
  try {
    const conta = await updateContaService.execute(id, req.body ?? {}, atorIdDe(res));
    res.json({ conta });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao atualizar conta" });
  }
}
