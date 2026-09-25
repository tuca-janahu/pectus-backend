import type { ModuloAuditoria, Prisma, PrismaClient, TipoEventoAuditoria } from "../../generated/prisma/client";
import { prisma } from "../../db/prisma";

export interface RegistrarLogInput {
  modulo: ModuloAuditoria;
  tipo: TipoEventoAuditoria;
  descricao: string;
  atorId?: number | null;
  metadata?: Record<string, unknown>;
}

export interface ListarLogsFiltro {
  de?: Date;
  ate?: Date;
  modulo?: ModuloAuditoria;
  busca?: string;
  limit: number;
  offset: number;
}

export interface LogResumo {
  id: number;
  modulo: ModuloAuditoria;
  tipo: TipoEventoAuditoria;
  descricao: string;
  atorId: number | null;
  ator: { id: number; nome: string; email: string } | null;
  metadata: unknown;
  criadoEm: Date;
}

export interface LogRepository {
  criar(input: RegistrarLogInput): Promise<void>;
  listar(filtro: ListarLogsFiltro): Promise<{ items: LogResumo[]; total: number }>;
}

export class PrismaLogRepository implements LogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async criar({ modulo, tipo, descricao, atorId, metadata }: RegistrarLogInput): Promise<void> {
    try {
      await this.prisma.logAuditoria.create({
        data: {
          modulo,
          tipo,
          descricao,
          atorId: atorId ?? undefined,
          metadata: (metadata as Prisma.InputJsonValue) ?? undefined,
        },
      });
    } catch (error) {
      // Best-effort: uma falha ao gravar o log de auditoria nunca pode derrubar
      // o fluxo principal (login, criacao de conta/paciente, etc).
      console.error("Falha ao registrar log de auditoria", { modulo, tipo }, error);
    }
  }

  async listar(filtro: ListarLogsFiltro): Promise<{ items: LogResumo[]; total: number }> {
    const where = {
      modulo: filtro.modulo,
      criadoEm:
        filtro.de || filtro.ate
          ? {
              gte: filtro.de,
              lte: filtro.ate,
            }
          : undefined,
      descricao: filtro.busca ? { contains: filtro.busca, mode: "insensitive" as const } : undefined,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.logAuditoria.findMany({
        where,
        include: { ator: { select: { id: true, nome: true, email: true } } },
        orderBy: { criadoEm: "desc" },
        take: filtro.limit,
        skip: filtro.offset,
      }),
      this.prisma.logAuditoria.count({ where }),
    ]);

    return { items, total };
  }
}

export const logRepository = new PrismaLogRepository(prisma);
