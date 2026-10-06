import type { Request, Response } from "express";
import { prisma } from "../../db/prisma";
import { mensagemDeErro } from "../../shared/error-message";
import { mailer } from "../email";
import { logRepository } from "../logs/log.repository";
import { storage } from "../storage";
import { PrismaContaRepository, type ContaResumo } from "./conta.repository";
import { RegisterService } from "./register.service";
import { UpdateContaService } from "./update-conta.service";
import { UpdateContaFotoService } from "./conta-foto.service";

const contaRepository = new PrismaContaRepository(prisma);
const registerService = new RegisterService(contaRepository, mailer, logRepository);
const updateContaService = new UpdateContaService(contaRepository, logRepository);
const updateContaFotoService = new UpdateContaFotoService(contaRepository, storage, logRepository);

function atorIdDe(res: Response): number | undefined {
  const user = res.locals.user as { id?: number } | undefined;
  return user?.id;
}

async function paraContaPublica(conta: ContaResumo) {
  const { fotoChave, ...resto } = conta;
  return { ...resto, fotoUrl: fotoChave ? await storage.getReadUrl({ key: fotoChave }) : null };
}

export async function createAccount(req: Request, res: Response) {
  try {
    const result = await registerService.execute(req.body ?? {}, atorIdDe(res));
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: mensagemDeErro(error) });
  }
}

export async function listAccounts(_req: Request, res: Response) {
  const contas = await contaRepository.listar();
  res.json({ contas: await Promise.all(contas.map(paraContaPublica)) });
}

export async function updateAccount(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Id invalido" });
  }
  try {
    const conta = await updateContaService.execute(id, req.body ?? {}, atorIdDe(res));
    res.json({ conta: await paraContaPublica(conta) });
  } catch (error) {
    res.status(400).json({ error: mensagemDeErro(error) });
  }
}

export async function uploadContaFoto(req: Request, res: Response) {
  const id = atorIdDe(res);
  if (!id) return res.status(401).json({ error: "Não autenticado" });
  if (!req.file) return res.status(400).json({ error: "Arquivo 'foto' não enviado." });
  try {
    const conta = await updateContaFotoService.execute(
      id,
      { buffer: req.file.buffer, mimetype: req.file.mimetype },
      id,
    );
    res.json({ conta: await paraContaPublica(conta) });
  } catch (error) {
    res.status(400).json({ error: mensagemDeErro(error) });
  }
}
