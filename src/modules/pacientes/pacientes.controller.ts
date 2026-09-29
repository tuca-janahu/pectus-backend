import type { Request, Response } from "express";
import { prisma } from "../../db/prisma";
import { PrismaLocalidadeRepository } from "../localidades/localidade.repository";
import { logRepository } from "../logs/log.repository";
import { storage } from "../storage";
import type { PacienteResumo, PacienteRepository } from "./paciente.repository";
import { PrismaPacienteRepository } from "./paciente.repository";
import {
  AtualizarPacienteService,
  BuscarPacienteService,
  CriarPacienteService,
  EnviarFotoPacienteService,
  ListarPacientesService,
} from "./paciente.service";

const pacienteRepository: PacienteRepository = new PrismaPacienteRepository(prisma);
const localidadeRepository = new PrismaLocalidadeRepository(prisma);

const criarPacienteService = new CriarPacienteService(pacienteRepository, localidadeRepository, logRepository);
const listarPacientesService = new ListarPacientesService(pacienteRepository);
const buscarPacienteService = new BuscarPacienteService(pacienteRepository);
const atualizarPacienteService = new AtualizarPacienteService(pacienteRepository, localidadeRepository);
const enviarFotoPacienteService = new EnviarFotoPacienteService(pacienteRepository, storage, logRepository);

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro interno.";
}

function atorIdDe(res: Response): number | undefined {
  const user = res.locals.user as { id?: number } | undefined;
  return user?.id;
}

async function paraPacientePublico(paciente: PacienteResumo) {
  const { fotoChave, ...resto } = paciente;
  return { ...resto, fotoUrl: fotoChave ? await storage.getReadUrl({ key: fotoChave }) : null };
}

export async function createPaciente(req: Request, res: Response) {
  try {
    const paciente = await criarPacienteService.execute(req.body ?? {}, atorIdDe(res));
    res.status(201).json({ paciente: await paraPacientePublico(paciente) });
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
}

export async function listPacientes(req: Request, res: Response) {
  const nome = typeof req.query.nome === "string" ? req.query.nome : undefined;
  const pacientes = await listarPacientesService.execute({ nome });
  res.json({ pacientes: await Promise.all(pacientes.map(paraPacientePublico)) });
}

export async function getPaciente(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Id inválido" });
  try {
    const paciente = await buscarPacienteService.execute(id);
    res.json({ paciente: await paraPacientePublico(paciente) });
  } catch (error) {
    res.status(404).json({ error: errorMessage(error) });
  }
}

export async function updatePaciente(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Id inválido" });
  try {
    const paciente = await atualizarPacienteService.execute(id, req.body ?? {});
    res.json({ paciente: await paraPacientePublico(paciente) });
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
}

export async function enviarFotoPaciente(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Id inválido" });
  if (!req.file) return res.status(400).json({ error: "Arquivo 'foto' não enviado." });
  try {
    const paciente = await enviarFotoPacienteService.execute(
      id,
      { buffer: req.file.buffer, mimetype: req.file.mimetype },
      atorIdDe(res),
    );
    res.json({ paciente: await paraPacientePublico(paciente) });
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
}
