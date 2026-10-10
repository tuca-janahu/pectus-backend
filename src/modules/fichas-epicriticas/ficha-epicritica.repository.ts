import type { Prisma, PrismaClient, StatusFicha } from "../../generated/prisma/client";
import type {
  AtualizarFichaEpicriticaData,
  ListarFichasEpicriticasFiltro,
  ReagendarFichaEpicriticaData,
} from "./ficha-epicritica.schema";

const INCLUDE = {
  paciente: { select: { id: true, nome: true } },
  medico: { select: { id: true, crm: true, conta: { select: { nome: true } } } },
} as const;

const CAMPOS_HERDAVEIS = {
  mecanismoLesao: true,
  dataInjuriaTraqueal: true,
  vocaliza: true,
  traqueostomizado: true,
  possuiComorbidades: true,
  comorbidadesDescricao: true,
  possuiSequelas: true,
  sequelasDescricao: true,
  usaMedicamentos: true,
  medicamentosDescricao: true,
  possuiLaringoscopia: true,
  achadoLaringoscopia: true,
  particularidades: true,
} as const;

export type FichaEpicriticaResumo = Prisma.FichaEpicriticaGetPayload<{ include: typeof INCLUDE }>;

export interface CriarFichaData {
  pacienteId: number;
  medicoId: number;
  dataHoraPrevista: Date;
  procedimento?: string | null;
  observacoes?: string | null;
}

export interface FichaEpicriticaRepository {
  criar(data: CriarFichaData): Promise<FichaEpicriticaResumo>;
  listar(filtro: ListarFichasEpicriticasFiltro): Promise<FichaEpicriticaResumo[]>;
  buscarPorId(id: number): Promise<FichaEpicriticaResumo | null>;
  pacienteExiste(id: number): Promise<boolean>;
  medicoAtivoExiste(id: number): Promise<boolean>;
  iniciarComHeranca(id: number): Promise<FichaEpicriticaResumo>;
  atualizarCamposClinicos(id: number, data: AtualizarFichaEpicriticaData): Promise<FichaEpicriticaResumo>;
  reagendar(id: number, data: ReagendarFichaEpicriticaData): Promise<FichaEpicriticaResumo>;
  alterarStatus(id: number, statusAtual: StatusFicha, novoStatus: StatusFicha): Promise<FichaEpicriticaResumo>;
}

export class PrismaFichaEpicriticaRepository implements FichaEpicriticaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  criar(data: CriarFichaData) {
    return this.prisma.fichaEpicritica.create({ data, include: INCLUDE });
  }

  listar(filtro: ListarFichasEpicriticasFiltro) {
    return this.prisma.fichaEpicritica.findMany({
      where: {
        pacienteId: filtro.pacienteId,
        medicoId: filtro.medicoId,
        status: filtro.status,
        dataHoraPrevista:
          filtro.de || filtro.ate
            ? { gte: filtro.de, lte: filtro.ate }
            : undefined,
      },
      include: INCLUDE,
      orderBy: [{ dataHoraPrevista: "desc" }, { id: "desc" }],
    });
  }

  buscarPorId(id: number) {
    return this.prisma.fichaEpicritica.findUnique({ where: { id }, include: INCLUDE });
  }

  async pacienteExiste(id: number) {
    return (await this.prisma.paciente.count({ where: { id, inativadoEm: null } })) > 0;
  }

  async medicoAtivoExiste(id: number) {
    return (
      (await this.prisma.medico.count({
        where: { id, inativadoEm: null, conta: { inativadoEm: null } },
      })) > 0
    );
  }

  async iniciarComHeranca(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const ficha = await tx.fichaEpicritica.findUnique({ where: { id } });
      if (!ficha) throw new Error("Ficha epicrítica não encontrada");
      if (ficha.status !== "AGENDADA") throw new Error("Apenas fichas agendadas podem ser iniciadas");

      const anterior = await tx.fichaEpicritica.findFirst({
        where: {
          pacienteId: ficha.pacienteId,
          status: "CONCLUIDA",
          id: { not: id },
        },
        select: CAMPOS_HERDAVEIS,
        orderBy: [{ dataHoraPrevista: "desc" }, { id: "desc" }],
      });

      const alterada = await tx.fichaEpicritica.updateMany({
        where: { id, status: "AGENDADA" },
        data: { ...(anterior ?? {}), status: "EM_PREENCHIMENTO" },
      });
      if (alterada.count !== 1) throw new Error("A ficha já foi iniciada ou alterada");

      return tx.fichaEpicritica.findUniqueOrThrow({ where: { id }, include: INCLUDE });
    });
  }

  async atualizarCamposClinicos(id: number, data: AtualizarFichaEpicriticaData) {
    const normalizados: Prisma.FichaEpicriticaUpdateInput = { ...data };
    if (data.possuiComorbidades === false) normalizados.comorbidadesDescricao = null;
    if (data.possuiSequelas === false) normalizados.sequelasDescricao = null;
    if (data.usaMedicamentos === false) normalizados.medicamentosDescricao = null;
    if (data.possuiLaringoscopia === false) normalizados.achadoLaringoscopia = null;

    const alterada = await this.prisma.fichaEpicritica.updateMany({
      where: { id, status: "EM_PREENCHIMENTO" },
      data: normalizados,
    });
    if (alterada.count !== 1) throw new Error("A ficha não está mais em preenchimento");
    return this.prisma.fichaEpicritica.findUniqueOrThrow({ where: { id }, include: INCLUDE });
  }

  async reagendar(id: number, data: ReagendarFichaEpicriticaData) {
    const alterada = await this.prisma.fichaEpicritica.updateMany({
      where: { id, status: "AGENDADA" },
      data,
    });
    if (alterada.count !== 1) throw new Error("A ficha não está mais agendada");
    return this.prisma.fichaEpicritica.findUniqueOrThrow({ where: { id }, include: INCLUDE });
  }

  async alterarStatus(id: number, statusAtual: StatusFicha, novoStatus: StatusFicha) {
    const alterada = await this.prisma.fichaEpicritica.updateMany({
      where: { id, status: statusAtual },
      data: { status: novoStatus },
    });
    if (alterada.count !== 1) throw new Error("A ficha foi alterada por outro usuário");
    return this.prisma.fichaEpicritica.findUniqueOrThrow({ where: { id }, include: INCLUDE });
  }
}
