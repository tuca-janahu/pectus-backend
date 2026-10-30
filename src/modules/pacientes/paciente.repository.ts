import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import type { AtualizarPacienteData, CriarPacienteData } from "./paciente.schema";

export interface PacienteResumo {
  id: number;
  nome: string;
  cpf: string | null;
  dataNascimento: Date;
  genero: string;
  municipio: { codigo: number; nome: string; estado: { codigo: number; sigla: string; nome: string } } | null;
  telefones: Array<{ telefone: string }>;
  fotoChave: string | null;
  inativadoEm: Date | null;
  criadoEm: Date;
  historicoCadastral?: Prisma.JsonValue;
}

export interface PacienteRepository {
  create(data: CriarPacienteData): Promise<PacienteResumo>;
  listar(filtro?: { nome?: string; incluirInativos?: boolean }): Promise<PacienteResumo[]>;
  buscarPorId(id: number): Promise<PacienteResumo | null>;
  atualizar(id: number, input: AtualizarPacienteData, atorId?: number): Promise<PacienteResumo>;
  atualizarFoto(id: number, fotoChave: string | null): Promise<PacienteResumo>;
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
        ficha: { create: {} },
      },
      include: INCLUDE,
    });
  }

  async listar(filtro?: { nome?: string; incluirInativos?: boolean }) {
    return this.prisma.paciente.findMany({
      omit: { historicoCadastral: true },
      where: {
        nome: filtro?.nome ? { contains: filtro.nome, mode: "insensitive" } : undefined,
        inativadoEm: filtro?.incluirInativos ? undefined : null,
      },
      include: INCLUDE,
      orderBy: { nome: "asc" },
    });
  }

  async buscarPorId(id: number) {
    return this.prisma.paciente.findUnique({ where: { id }, include: INCLUDE });
  }

  async atualizar(id: number, input: AtualizarPacienteData, atorId?: number) {
    const { ativo, telefones, ...campos } = input;

    await this.prisma.$transaction(async (tx) => {
      const antes = await tx.paciente.findUniqueOrThrow({
        where: { id },
        include: { telefones: { select: { telefone: true } } },
      });
      const proximo = {
        nome: campos.nome ?? antes.nome,
        cpf: campos.cpf ?? antes.cpf,
        dataNascimento: campos.dataNascimento ?? antes.dataNascimento,
        genero: campos.genero ?? antes.genero,
        municipioId: campos.municipioId ?? antes.municipioId,
        inativadoEm: ativo === undefined ? antes.inativadoEm : ativo ? null : new Date(),
        telefones: telefones ?? antes.telefones.map((item) => item.telefone),
      };
      const mudancas: Record<string, { antes: unknown; depois: unknown }> = {};
      for (const [campo, depois] of Object.entries(proximo)) {
        const anterior = campo === "telefones" ? antes.telefones.map((item) => item.telefone) : antes[campo as keyof typeof proximo];
        if (JSON.stringify(anterior) !== JSON.stringify(depois)) mudancas[campo] = { antes: anterior, depois };
      }
      const historico: unknown[] = Array.isArray(antes.historicoCadastral) ? [...antes.historicoCadastral] : [];
      if (Object.keys(mudancas).length) historico.push({ em: new Date().toISOString(), autorContaId: atorId ?? null, campos: mudancas });
      await tx.paciente.update({
        where: { id },
        data: {
          ...campos,
          inativadoEm: ativo === undefined ? undefined : proximo.inativadoEm,
          historicoCadastral: historico as Prisma.InputJsonValue,
        },
      });

      if (telefones) {
        await tx.telefone.deleteMany({ where: { pacienteId: id } });
        if (telefones.length > 0) {
          await tx.telefone.createMany({ data: telefones.map((telefone) => ({ pacienteId: id, telefone })) });
        }
      }
    }, { isolationLevel: "Serializable" });

    const atualizado = await this.buscarPorId(id);
    if (!atualizado) throw new Error("Paciente não encontrado");
    return atualizado;
  }

  async atualizarFoto(id: number, fotoChave: string | null) {
    return this.prisma.paciente.update({ where: { id }, data: { fotoChave }, include: INCLUDE });
  }
}
