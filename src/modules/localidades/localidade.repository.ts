import type { PrismaClient } from "../../generated/prisma/client";

export interface EstadoResumo {
  codigo: number;
  sigla: string;
  nome: string;
}

export interface MunicipioResumo {
  codigo: number;
  nome: string;
  estadoCodigo: number;
  pertenceRmBelem: boolean;
}

export interface LocalidadeRepository {
  listarEstados(): Promise<EstadoResumo[]>;
  listarMunicipiosPorEstado(estadoCodigo: number): Promise<MunicipioResumo[]>;
  buscarMunicipioPorCodigo(codigo: number): Promise<MunicipioResumo | null>;
  atualizarMunicipio(codigo: number, input: { pertenceRmBelem: boolean }): Promise<MunicipioResumo>;
}

export class PrismaLocalidadeRepository implements LocalidadeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listarEstados(): Promise<EstadoResumo[]> {
    return this.prisma.estado.findMany({ orderBy: { nome: "asc" } });
  }

  async listarMunicipiosPorEstado(estadoCodigo: number): Promise<MunicipioResumo[]> {
    return this.prisma.municipio.findMany({
      where: { estadoCodigo },
      orderBy: { nome: "asc" },
    });
  }

  async buscarMunicipioPorCodigo(codigo: number): Promise<MunicipioResumo | null> {
    return this.prisma.municipio.findUnique({ where: { codigo } });
  }

  async atualizarMunicipio(codigo: number, input: { pertenceRmBelem: boolean }): Promise<MunicipioResumo> {
    return this.prisma.municipio.update({ where: { codigo }, data: { pertenceRmBelem: input.pertenceRmBelem } });
  }
}
