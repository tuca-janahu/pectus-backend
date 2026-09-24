import type { PrismaClient } from "../../generated/prisma/client";
import type { AtualizarPacienteData, CriarPacienteData } from "./paciente.schema";

export interface PacienteResumo {
  id: number;
  nome: string;
  cpf: string | null;
  dataNascimento: Date;
  genero: string;
  municipio: { codigo: number; nome: string; estado: { sigla: string; nome: string } } | null;
  telefones: Array<{ telefone: string }>;
  inativadoEm: Date | null;
  criadoEm: Date;
}

export interface PacienteRepository {
  create(data: CriarPacienteData): Promise<PacienteResumo>;
  listar(filtro?: { nome?: string }): Promise<PacienteResumo[]>;
  buscarPorId(id: number): Promise<PacienteResumo | null>;
  atualizar(id: number, input: AtualizarPacienteData): Promise<PacienteResumo>;
}

const INCLUDE = {
  municipio: { include: { estado: true } },
  telefones: { select: { telefone: true } },
} as const;

export class PrismaPacienteRepository implements PacienteRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create({ nome, cpf, dataNascimento, genero, municipioId, telefones }: CriarPacienteData) {
    return this.prisma.paciente.create({
      data: {
        nome,
        cpf,
        dataNascimento,
        genero,
        municipioId,
        telefones: { create: telefones.map((telefone) => ({ telefone })) },
      },
      include: INCLUDE,
    });
  }

  async listar(filtro?: { nome?: string }) {
    return this.prisma.paciente.findMany({
      where: filtro?.nome ? { nome: { contains: filtro.nome, mode: "insensitive" } } : undefined,
      include: INCLUDE,
      orderBy: { nome: "asc" },
    });
  }

  async buscarPorId(id: number) {
    return this.prisma.paciente.findUnique({ where: { id }, include: INCLUDE });
  }

  async atualizar(id: number, input: AtualizarPacienteData) {
    const { ativo, telefones, ...campos } = input;

    await this.prisma.$transaction(async (tx) => {
      await tx.paciente.update({
        where: { id },
        data: {
          ...campos,
          inativadoEm: ativo === undefined ? undefined : ativo ? null : new Date(),
        },
      });

      if (telefones) {
        await tx.telefone.deleteMany({ where: { pacienteId: id } });
        if (telefones.length > 0) {
          await tx.telefone.createMany({ data: telefones.map((telefone) => ({ pacienteId: id, telefone })) });
        }
      }
    });

    const atualizado = await this.buscarPorId(id);
    if (!atualizado) throw new Error("Paciente não encontrado");
    return atualizado;
  }
}
