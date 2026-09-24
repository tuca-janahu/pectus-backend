import type { Request, Response } from "express";
import { prisma } from "../../db/prisma";
import { PrismaLocalidadeRepository } from "../localidades/localidade.repository";
import { PrismaPacienteRepository } from "./paciente.repository";
import { AtualizarPacienteService, BuscarPacienteService, CriarPacienteService, ListarPacientesService } from "./paciente.service";

const pacienteRepository = new PrismaPacienteRepository(prisma);
const localidadeRepository = new PrismaLocalidadeRepository(prisma);

const criarPacienteService = new CriarPacienteService(pacienteRepository, localidadeRepository);
const listarPacientesService = new ListarPacientesService(pacienteRepository);
const buscarPacienteService = new BuscarPacienteService(pacienteRepository);
const atualizarPacienteService = new AtualizarPacienteService(pacienteRepository, localidadeRepository);

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro interno.";
}

export async function createPaciente(req: Request, res: Response) {
  try {
    const paciente = await criarPacienteService.execute(req.body ?? {});
    res.status(201).json({ paciente });
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
}

export async function listPacientes(req: Request, res: Response) {
  const nome = typeof req.query.nome === "string" ? req.query.nome : undefined;
  const pacientes = await listarPacientesService.execute({ nome });
  res.json({ pacientes });
}

export async function getPaciente(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Id inválido" });
  try {
    const paciente = await buscarPacienteService.execute(id);
    res.json({ paciente });
  } catch (error) {
    res.status(404).json({ error: errorMessage(error) });
  }
}

export async function updatePaciente(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Id inválido" });
  try {
    const paciente = await atualizarPacienteService.execute(id, req.body ?? {});
    res.json({ paciente });
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
}
