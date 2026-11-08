import type { PrismaClient } from "../../generated/prisma/client";
import { DashboardRepository } from "./dashboard.repository";
import type { DashboardFiltro, DashboardMapaFiltro } from "./dashboard.schema";

const STATUS = ["AGENDADA", "EM_PREENCHIMENTO", "CONCLUIDA", "CANCELADA"] as const;
const FAIXAS = ["0–17", "18–29", "30–44", "45–59", "60+"];
const numero = (valor: bigint | undefined) => Number(valor ?? 0n);

function inicioDoPeriodo(data: string, granularidade: DashboardFiltro["granularidade"]) {
  const dia = new Date(`${data}T00:00:00Z`);
  if (granularidade === "mes") dia.setUTCDate(1);
  if (granularidade === "semana") dia.setUTCDate(dia.getUTCDate() - ((dia.getUTCDay() + 6) % 7));
  return dia;
}

function proximoPeriodo(data: Date, granularidade: DashboardFiltro["granularidade"]) {
  const proximo = new Date(data);
  if (granularidade === "mes") proximo.setUTCMonth(proximo.getUTCMonth() + 1);
  else proximo.setUTCDate(proximo.getUTCDate() + (granularidade === "semana" ? 7 : 1));
  return proximo;
}

export class DashboardService {
  private readonly repository: DashboardRepository;
  constructor(private readonly db: PrismaClient) {
    this.repository = new DashboardRepository(db);
  }

  listarMedicos() {
    return this.db.medico.findMany({
      where: { inativadoEm: null, conta: { inativadoEm: null } },
      select: { id: true, conta: { select: { nome: true } } },
      orderBy: { conta: { nome: "asc" } },
    });
  }

  async localidadeValida(estadoCodigo?: number, municipioCodigo?: number) {
    if (!estadoCodigo) return true;
    if (municipioCodigo) {
      return Boolean(await this.db.municipio.findFirst({ where: { codigo: municipioCodigo, estadoCodigo }, select: { codigo: true } }));
    }
    return Boolean(await this.db.estado.findUnique({ where: { codigo: estadoCodigo }, select: { codigo: true } }));
  }

  async mapa(filtro: DashboardMapaFiltro) {
    const [contagens, estados, municipios] = await Promise.all([
      this.repository.consultarMapa(filtro),
      this.db.estado.findMany({ select: { codigo: true, sigla: true, nome: true }, orderBy: { nome: "asc" } }),
      filtro.estadoCodigo
        ? this.db.municipio.findMany({ where: { estadoCodigo: filtro.estadoCodigo }, select: { codigo: true, nome: true }, orderBy: { nome: "asc" } })
        : Promise.resolve([]),
    ]);
    const porMunicipio = new Map(contagens.map((item) => [item.municipioCodigo, numero(item.total)]));
    const porEstado = new Map<number, number>();
    for (const item of contagens) {
      if (item.estadoCodigo !== null) porEstado.set(item.estadoCodigo, (porEstado.get(item.estadoCodigo) ?? 0) + numero(item.total));
    }
    return {
      totalPacientes: contagens.reduce((soma, item) => soma + numero(item.total), 0),
      semLocalidade: porMunicipio.get(null) ?? 0,
      estados: estados.map((item) => ({ ...item, total: porEstado.get(item.codigo) ?? 0 })),
      municipios: municipios.map((item) => ({ ...item, total: porMunicipio.get(item.codigo) ?? 0 })),
    };
  }

  async resumo(filtro: DashboardFiltro) {
    const dados = await this.repository.consultar(filtro);
    const porStatus = STATUS.map((status) => ({ status, total: numero(dados.status.find((item) => item.chave === status)?.total) }));
    const totalAtendimentos = porStatus.reduce((soma, item) => soma + item.total, 0);
    const serieMap = new Map<string, Record<string, number>>();
    for (const item of dados.serie) {
      const chave = item.periodo.toISOString().slice(0, 10);
      const valores = serieMap.get(chave) ?? {};
      valores[item.status] = numero(item.total);
      serieMap.set(chave, valores);
    }
    const serieAtendimentos = [];
    for (let dia = inicioDoPeriodo(filtro.de, filtro.granularidade), fim = new Date(`${filtro.ate}T00:00:00Z`);
      dia <= fim; dia = proximoPeriodo(dia, filtro.granularidade)) {
      const periodo = dia.toISOString().slice(0, 10);
      const valores = serieMap.get(periodo) ?? {};
      serieAtendimentos.push({ periodo, ...Object.fromEntries(STATUS.map((status) => [status, valores[status] ?? 0])) });
    }

    const clinica = dados.clinica;
    const denominadorPacientes = numero(clinica?.total);
    const grupos = ["RM_BELEM", "OUTRAS_LOCALIDADES", "NAO_INFORMADO"] as const;
    const porRegiao = grupos.map((grupo) => ({
      grupo, total: dados.regiao.filter((item) => item.grupo === grupo).reduce((soma, item) => soma + numero(item.total), 0),
    }));
    const procedimentos = dados.procedimentos.map((item) => ({ procedimento: item.chave, total: numero(item.total) }));
    const porProcedimento = procedimentos.length > 8
      ? [...procedimentos.slice(0, 7), {
        procedimento: "Demais procedimentos",
        total: procedimentos.slice(7).reduce((soma, item) => soma + item.total, 0),
      }]
      : procedimentos;

    return {
      periodo: { ...filtro, fuso: "America/Sao_Paulo" },
      indicadores: {
        atendimentos: totalAtendimentos,
        concluidos: porStatus.find((item) => item.status === "CONCLUIDA")!.total,
        cancelados: porStatus.find((item) => item.status === "CANCELADA")!.total,
        pacientesAtendidos: denominadorPacientes,
        fichasEmTratamento: numero(clinica?.emTratamento),
      },
      serieAtendimentos,
      porStatus,
      porProcedimento,
      demografia: {
        denominadorPacientes,
        porFaixaEtaria: FAIXAS.map((faixa) => ({ faixa, total: numero(dados.idades.find((item) => item.chave === faixa)?.total) })),
        porGenero: ["MASCULINO", "FEMININO"].map((genero) => ({ genero, total: numero(dados.generos.find((item) => item.chave === genero)?.total) })),
      },
      clinica: {
        denominadorPacientes,
        registrosPositivos: [
          ["vocaliza", clinica?.vocaliza], ["traqueostomizado", clinica?.traqueostomizado],
          ["comorbidades", clinica?.comorbidades], ["sequelas", clinica?.sequelas],
          ["medicamentos", clinica?.medicamentos], ["laringoscopia", clinica?.laringoscopia],
        ].map(([indicador, total]) => ({ indicador, total: numero(total as bigint | undefined) })),
        porSituacao: [
          { situacao: "EM_TRATAMENTO", total: numero(clinica?.emTratamento) },
          { situacao: "FORA_DE_TRATAMENTO", total: numero(clinica?.foraTratamento) },
        ],
        porMotivoEncerramento: [
          { motivo: "ALTA", total: numero(clinica?.alta) },
          { motivo: "ABANDONO", total: numero(clinica?.abandono) },
          { motivo: "OBITO", total: numero(clinica?.obito) },
        ],
      },
      regiao: {
        denominadorPacientes,
        porGrupo: porRegiao,
        municipiosRmBelem: dados.regiao.filter((item) => item.grupo === "RM_BELEM")
          .map((item) => ({ codigo: item.codigo, municipio: item.municipio, total: numero(item.total) })),
      },
    };
  }
}
