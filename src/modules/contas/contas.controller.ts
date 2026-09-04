import type { Request, Response } from "express";
import { prisma } from "../../db/prisma";
import { PrismaContaRepository } from "./conta.repository";
import { RegisterService } from "./register.service";

const registerService = new RegisterService(new PrismaContaRepository(prisma));

export async function createAccount(req: Request, res: Response) {
  try {
    const result = await registerService.execute(req.body ?? {});
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao criar conta" });
  }
}
