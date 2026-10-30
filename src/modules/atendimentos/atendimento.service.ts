import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import {
  atualizarAtendimentoSchema,
  camposClinicosSchema,
  criarAtendimentoSchema,
  listarAtendimentosSchema,
  reagendarAtendimentoSchema,
  situacaoFichaSchema,
} from "./atendimento.schema";
import { googleCalendarService } from "../google-calendar/google-calendar.service";

export interface Ator {
  id: number;
  roles: string[];
  medico: { id: number } | null;
}

const include = {
  ficha: { include: { paciente: { select: { id: true, nome: true, inativadoEm: true } } } },
  medico: { select: { id: true, crm: true, contaId: true, conta: { select: { nome: true } } } },
} as const;

type AtendimentoCompleto = Prisma.AtendimentoGetPayload<{ include: typeof include }>;
type Db = Prisma.TransactionClient;
const MINUTOS = 60;
const ABERTOS = ["AGENDADA", "EM_PREENCHIMENTO"] as const;

export class AtendimentoErro extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

function autorizadoParaEditar(atendimento: AtendimentoCompleto, ator: Ator) {
  if (ator.roles.includes("ADMIN")) return;
  if (ator.medico?.id !== atendimento.medicoId) {
    throw new AtendimentoErro("Somente o médico responsável pode alterar um atendimento aberto", 403);
  }
}

function historicoAtual(value: Prisma.JsonValue): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item) =>
    typeof item === "object" && item !== null && !Array.isArray(item)) as Record<string, unknown>[] : [];
}

function diferente(a: unknown, b: unknown) {
  return JSON.stringify(a) !== JSON.stringify(b);
}

function diferencas(atual: Record<string, unknown>, novo: Record<string, unknown>) {
  const campos: Record<string, { antes: unknown; depois: unknown }> = {};
  for (const [campo, depois] of Object.entries(novo)) {
    const antes = atual[campo];
    if (diferente(antes, depois)) campos[campo] = { antes, depois };
  }
  return campos;
}

function evento(tipo: string, atorId: number, campos: Record<string, unknown>) {
  return { tipo, em: new Date().toISOString(), autorContaId: atorId, campos };
}

export class AtendimentoService {
  constructor(private readonly prisma: PrismaClient) {}

  async fichaDoPaciente(pacienteId: number) {
    const ficha = await this.prisma.ficha.findUnique({
      where: { pacienteId },
      include: { paciente: { select: { id: true, nome: true, inativadoEm: true } } },
    });
    if (!ficha) throw new AtendimentoErro("Ficha não encontrada", 404);
    return ficha;
  }

  listar(input: unknown) {
    const filtro = listarAtendimentosSchema.parse(input);
    if (filtro.de && filtro.ate && filtro.de > filtro.ate) {
      throw new AtendimentoErro("Intervalo de datas inválido", 400);
    }
    return this.prisma.atendimento.findMany({
      where: {
        ficha: filtro.pacienteId ? { pacienteId: filtro.pacienteId } : undefined,
        medicoId: filtro.medicoId,
        status: filtro.status,
        dataHoraPrevista: filtro.de || filtro.ate ? { gte: filtro.de, lte: filtro.ate } : undefined,
      },
      include,
      orderBy: [{ dataHoraPrevista: "desc" }, { id: "desc" }],
    });
  }

  async buscarPorId(id: number) {
    const atendimento = await this.prisma.atendimento.findUnique({ where: { id }, include });
    if (!atendimento) throw new AtendimentoErro("Atendimento não encontrado", 404);
    return atendimento;
  }

  private async semConflito(db: Db, fichaId: number, medicoId: number, inicio: Date, ignorarId?: number) {
    const fim = new Date(inicio.getTime() + MINUTOS * 60_000);
    const inicioAnterior = new Date(inicio.getTime() - MINUTOS * 60_000);
    const conflitos = await db.atendimento.findMany({
      where: {
        id: ignorarId ? { not: ignorarId } : undefined,
        status: { in: [...ABERTOS] },
        dataHoraPrevista: { gt: inicioAnterior, lt: fim },
        OR: [{ fichaId }, { medicoId }],
      },
      select: { fichaId: true, medicoId: true },
    });
    if (conflitos.some((item) => item.fichaId === fichaId)) {
      throw new AtendimentoErro("Paciente já possui atendimento nesse horário", 409);
    }
    if (conflitos.length) throw new AtendimentoErro("Médico já possui atendimento nesse horário", 409);
  }

  async criar(input: unknown, ator: Ator) {
    const data = criarAtendimentoSchema.parse(input);
    if (!ator.roles.includes("ADMIN") && ator.medico?.id !== data.medicoId) {
      throw new AtendimentoErro("Não é permitido agendar para outro médico", 403);
    }
    const inicio = data.iniciarAgora ? new Date() : data.dataHoraPrevista;
    if (!inicio) throw new AtendimentoErro("Informe data e horário", 400);
    if (!data.iniciarAgora && inicio <= new Date()) {
      throw new AtendimentoErro("Não é permitido agendar no passado", 400);
    }
    const atendimento = await this.prisma.$transaction(async (tx) => {
      const ficha = await tx.ficha.findUnique({
        where: { pacienteId: data.pacienteId },
        include: { paciente: true },
      });
      if (!ficha || ficha.paciente.inativadoEm) throw new AtendimentoErro("Paciente não encontrado ou inativo", 404);
      if (ficha.situacao === "FORA_DE_TRATAMENTO" && ficha.motivoEncerramento === "OBITO") {
        throw new AtendimentoErro("Óbito registrado: novos atendimentos não são permitidos", 409);
      }
      const medico = await tx.medico.findFirst({
        where: { id: data.medicoId, inativadoEm: null, conta: { inativadoEm: null } },
      });
      if (!medico) throw new AtendimentoErro("Médico não encontrado ou inativo", 404);
      await this.semConflito(tx, ficha.id, data.medicoId, inicio);
      const criado = await tx.atendimento.create({
        data: {
          fichaId: ficha.id,
          medicoId: data.medicoId,
          dataHoraPrevista: inicio,
          procedimento: data.procedimento,
          procedimentoOutro: data.procedimentoOutro,
          observacoes: data.observacoes,
          status: data.iniciarAgora ? "EM_PREENCHIMENTO" : "AGENDADA",
          historico: ([evento("CRIADO", ator.id, { status: { antes: null, depois: data.iniciarAgora ? "EM_PREENCHIMENTO" : "AGENDADA" } }), ...(data.iniciarAgora && ficha.situacao === "FORA_DE_TRATAMENTO" ? [evento("SITUACAO_ALTERADA", ator.id, {
            situacao: { antes: ficha.situacao, depois: "EM_TRATAMENTO" },
            motivoEncerramento: { antes: ficha.motivoEncerramento, depois: null },
            dataEncerramento: { antes: ficha.dataEncerramento, depois: null },
          })] : [])]) as Prisma.InputJsonValue,
        },
      });
      if (data.iniciarAgora && ficha.situacao === "FORA_DE_TRATAMENTO") {
        await tx.ficha.update({
          where: { id: ficha.id },
          data: { situacao: "EM_TRATAMENTO", motivoEncerramento: null, dataEncerramento: null },
        });
      }
      return tx.atendimento.findUniqueOrThrow({ where: { id: criado.id }, include });
    }, { isolationLevel: "Serializable" });
    void googleCalendarService.criarEventoParaAtendimento(atendimento.id);
    return atendimento;
  }

  async iniciar(id: number, ator: Ator) {
    const resultado = await this.prisma.$transaction(async (tx) => {
      const atual = await tx.atendimento.findUnique({ where: { id }, include });
      if (!atual) throw new AtendimentoErro("Atendimento não encontrado", 404);
      autorizadoParaEditar(atual, ator);
      if (atual.status !== "AGENDADA") throw new AtendimentoErro("Somente agendados podem ser iniciados", 409);
      if (atual.ficha.situacao === "FORA_DE_TRATAMENTO" && atual.ficha.motivoEncerramento === "OBITO") {
        throw new AtendimentoErro("Óbito registrado: atendimento não pode ser iniciado", 409);
      }
      const reativar = atual.ficha.situacao === "FORA_DE_TRATAMENTO";
      if (reativar) {
        await tx.ficha.update({ where: { id: atual.fichaId }, data: {
          situacao: "EM_TRATAMENTO", motivoEncerramento: null, dataEncerramento: null,
        } });
      }
      return tx.atendimento.update({
        where: { id },
        data: { status: "EM_PREENCHIMENTO", historico: [
          ...historicoAtual(atual.historico), evento("INICIADO", ator.id, { status: { antes: "AGENDADA", depois: "EM_PREENCHIMENTO" } }),
          ...(reativar ? [evento("SITUACAO_ALTERADA", ator.id, {
            situacao: { antes: atual.ficha.situacao, depois: "EM_TRATAMENTO" },
            motivoEncerramento: { antes: atual.ficha.motivoEncerramento, depois: null },
            dataEncerramento: { antes: atual.ficha.dataEncerramento, depois: null },
          })] : []),
        ] as Prisma.InputJsonValue },
        include,
      });
    }, { isolationLevel: "Serializable" });
    return resultado;
  }

  async reagendar(id: number, input: unknown, ator: Ator) {
    const data = reagendarAtendimentoSchema.parse(input);
    const resultado = await this.prisma.$transaction(async (tx) => {
      const atual = await tx.atendimento.findUnique({ where: { id }, include });
      if (!atual) throw new AtendimentoErro("Atendimento não encontrado", 404);
      autorizadoParaEditar(atual, ator);
      if (atual.status !== "AGENDADA") throw new AtendimentoErro("Somente agendados podem ser reagendados", 409);
      const medicoId = data.medicoId ?? atual.medicoId;
      if (!ator.roles.includes("ADMIN") && medicoId !== atual.medicoId) {
        throw new AtendimentoErro("Somente administrador pode transferir o atendimento", 403);
      }
      const inicio = data.dataHoraPrevista ?? atual.dataHoraPrevista;
      if (inicio <= new Date()) throw new AtendimentoErro("Não é permitido agendar no passado", 400);
      if (data.medicoId !== undefined) {
        const ativo = await tx.medico.count({ where: { id: medicoId, inativadoEm: null, conta: { inativadoEm: null } } });
        if (!ativo) throw new AtendimentoErro("Médico não encontrado ou inativo", 404);
      }
      await this.semConflito(tx, atual.fichaId, medicoId, inicio, id);
      const campos = diferencas(atual as unknown as Record<string, unknown>, {
        medicoId, dataHoraPrevista: inicio,
        ...(data.procedimento !== undefined ? { procedimento: data.procedimento } : {}),
        ...(data.procedimentoOutro !== undefined ? { procedimentoOutro: data.procedimentoOutro } : {}),
        ...(data.observacoes !== undefined ? { observacoes: data.observacoes } : {}),
      });
      const atualizado = await tx.atendimento.update({
        where: { id },
        data: {
          medicoId,
          dataHoraPrevista: inicio,
          procedimento: data.procedimento === undefined ? undefined : data.procedimento,
          procedimentoOutro: data.procedimentoOutro === undefined ? undefined : data.procedimentoOutro,
          observacoes: data.observacoes === undefined ? undefined : data.observacoes,
          historico: [...historicoAtual(atual.historico), ...(Object.keys(campos).length ? [evento("REAGENDADO", ator.id, campos)] : [])] as Prisma.InputJsonValue,
        },
        include,
      });
      return { atendimento: atualizado, medicoAnteriorContaId: atual.medico.contaId,
        eventoAnteriorId: atual.googleEventId, transferido: medicoId !== atual.medicoId };
    }, { isolationLevel: "Serializable" });
    if (resultado.transferido) {
      void googleCalendarService.transferirEventoParaAtendimento(id, resultado.medicoAnteriorContaId, resultado.eventoAnteriorId);
    } else {
      void googleCalendarService.atualizarEventoParaAtendimento(id);
    }
    return resultado.atendimento;
  }

  private async salvarClinico(tx: Db, atual: AtendimentoCompleto, clinico: unknown, ator: Ator, tipo: string,
    extras: Record<string, unknown> = {}) {
    const dados = camposClinicosSchema.parse(clinico ?? {});
    const normalizados: Record<string, unknown> = { ...dados };
    if (dados.possuiComorbidades === false) normalizados.comorbidadesDescricao = null;
    if (dados.possuiSequelas === false) normalizados.sequelasDescricao = null;
    if (dados.usaMedicamentos === false) normalizados.medicamentosDescricao = null;
    if (dados.possuiLaringoscopia === false) normalizados.achadoLaringoscopia = null;
    const mudancas = diferencas(atual.ficha as unknown as Record<string, unknown>, normalizados);
    const eventos = historicoAtual(atual.historico);
    if (Object.keys(mudancas).length || Object.keys(extras).length) {
      eventos.push(evento(tipo, ator.id, { ...mudancas, ...extras }));
    }
    if (Object.keys(mudancas).length) {
      await tx.ficha.update({
        where: { id: atual.fichaId },
        data: normalizados as Prisma.FichaUpdateInput,
      });
    }
    return eventos;
  }

  async atualizar(id: number, input: unknown, ator: Ator, corrigir = false) {
    const data = atualizarAtendimentoSchema.parse(input);
    return this.prisma.$transaction(async (tx) => {
      const atual = await tx.atendimento.findUnique({ where: { id }, include });
      if (!atual) throw new AtendimentoErro("Atendimento não encontrado", 404);
      if (corrigir) {
        if (atual.status !== "CONCLUIDA") throw new AtendimentoErro("Somente concluídos podem ser corrigidos", 409);
        if (!ator.roles.includes("MEDICO")) throw new AtendimentoErro("Correção clínica exige perfil médico", 403);
      } else {
        autorizadoParaEditar(atual, ator);
        if (atual.status !== "EM_PREENCHIMENTO") throw new AtendimentoErro("Atendimento não está em preenchimento", 409);
      }
      const alteracoesClinicas = data.clinico ? diferencas(atual.ficha as unknown as Record<string, unknown>, data.clinico) : {};
      if (corrigir && Object.keys(alteracoesClinicas).length) {
        const posterior = await tx.atendimento.findFirst({
          where: { fichaId: atual.fichaId, dataHoraPrevista: { gt: atual.dataHoraPrevista },
            status: { in: ["EM_PREENCHIMENTO", "CONCLUIDA"] } },
          select: { id: true },
        });
        if (posterior) throw new AtendimentoErro("Campos da ficha só podem ser corrigidos no atendimento clínico mais recente", 409);
      }
      const extras = diferencas(atual as unknown as Record<string, unknown>, {
        ...(data.procedimento !== undefined ? { procedimento: data.procedimento } : {}),
        ...(data.procedimentoOutro !== undefined ? { procedimentoOutro: data.procedimentoOutro } : {}),
        ...(data.observacoes !== undefined ? { observacoes: data.observacoes } : {}),
      });
      const historico = await this.salvarClinico(tx, atual, data.clinico, ator,
        corrigir ? "ATENDIMENTO_CORRIGIDO" : "FICHA_ALTERADA", extras);
      return tx.atendimento.update({
        where: { id },
        data: {
          procedimento: data.procedimento === undefined ? undefined : data.procedimento,
          procedimentoOutro: data.procedimentoOutro === undefined ? undefined : data.procedimentoOutro,
          observacoes: data.observacoes === undefined ? undefined : data.observacoes,
          historico: historico as Prisma.InputJsonValue,
        },
        include,
      });
    }, { isolationLevel: "Serializable" });
  }

  async concluir(id: number, ator: Ator) {
    return this.prisma.$transaction(async (tx) => {
      const atual = await tx.atendimento.findUnique({ where: { id }, include });
      if (!atual) throw new AtendimentoErro("Atendimento não encontrado", 404);
      autorizadoParaEditar(atual, ator);
      if (atual.status !== "EM_PREENCHIMENTO") throw new AtendimentoErro("Somente atendimentos em preenchimento podem ser concluídos", 409);
      if (!atual.ficha.dataInjuriaTraqueal) throw new AtendimentoErro("Informe a data da injúria traqueal", 400);
      if (!atual.procedimento) throw new AtendimentoErro("Informe o procedimento", 400);
      return tx.atendimento.update({
        where: { id },
        data: { status: "CONCLUIDA", historico: [
          ...historicoAtual(atual.historico), evento("CONCLUIDO", ator.id, { status: { antes: "EM_PREENCHIMENTO", depois: "CONCLUIDA" } }),
        ] as Prisma.InputJsonValue },
        include,
      });
    }, { isolationLevel: "Serializable" });
  }

  async cancelar(id: number, ator: Ator) {
    const resultado = await this.prisma.$transaction(async (tx) => {
      const atual = await tx.atendimento.findUnique({ where: { id }, include });
      if (!atual) throw new AtendimentoErro("Atendimento não encontrado", 404);
      autorizadoParaEditar(atual, ator);
      if (!ABERTOS.includes(atual.status as typeof ABERTOS[number])) {
        throw new AtendimentoErro("Somente atendimentos abertos podem ser cancelados", 409);
      }
      return tx.atendimento.update({
        where: { id },
        data: {
          status: "CANCELADA",
          historico: [...historicoAtual(atual.historico), evento("CANCELADO", ator.id, {
            status: { antes: atual.status, depois: "CANCELADA" },
          })] as Prisma.InputJsonValue,
        },
        include,
      });
    }, { isolationLevel: "Serializable" });
    void googleCalendarService.removerEventoParaAtendimento(id);
    return resultado;
  }

  async alterarSituacao(id: number, input: unknown, ator: Ator) {
    if (!ator.roles.includes("MEDICO")) throw new AtendimentoErro("A alteração clínica exige perfil médico", 403);
    const data = situacaoFichaSchema.parse(input);
    return this.prisma.$transaction(async (tx) => {
      const atual = await tx.atendimento.findUnique({ where: { id }, include });
      if (!atual) throw new AtendimentoErro("Atendimento não encontrado", 404);
      if (atual.status === "EM_PREENCHIMENTO") autorizadoParaEditar(atual, ator);
      if (atual.status !== "EM_PREENCHIMENTO" && atual.status !== "CONCLUIDA") {
        throw new AtendimentoErro("A situação clínica exige atendimento iniciado", 409);
      }
      const posterior = await tx.atendimento.findFirst({
        where: { fichaId: atual.fichaId, dataHoraPrevista: { gt: atual.dataHoraPrevista }, status: { in: ["EM_PREENCHIMENTO", "CONCLUIDA"] } },
        select: { id: true },
      });
      if (posterior) throw new AtendimentoErro("Altere a situação clínica no atendimento mais recente", 409);
      if (data.motivoEncerramento === "OBITO") {
        const futuros = await tx.atendimento.count({
          where: { fichaId: atual.fichaId, id: { not: id }, status: { in: [...ABERTOS] }, dataHoraPrevista: { gt: atual.dataHoraPrevista } },
        });
        if (futuros) throw new AtendimentoErro("Cancele os agendamentos futuros antes de registrar óbito", 409);
      }
      const mudancas = diferencas(atual.ficha as unknown as Record<string, unknown>, {
        situacao: data.situacao,
        motivoEncerramento: data.situacao === "EM_TRATAMENTO" ? null : data.motivoEncerramento,
        dataEncerramento: data.situacao === "EM_TRATAMENTO" ? null : data.dataEncerramento,
      });
      if (Object.keys(mudancas).length) {
        await tx.ficha.update({
          where: { id: atual.fichaId },
          data: {
            situacao: data.situacao,
            motivoEncerramento: data.situacao === "EM_TRATAMENTO" ? null : data.motivoEncerramento,
            dataEncerramento: data.situacao === "EM_TRATAMENTO" ? null : data.dataEncerramento,
          },
        });
      }
      return tx.atendimento.update({
        where: { id },
        data: {
          historico: [...historicoAtual(atual.historico), ...(Object.keys(mudancas).length
            ? [evento("SITUACAO_ALTERADA", ator.id, mudancas)] : [])] as Prisma.InputJsonValue,
        },
        include,
      });
    }, { isolationLevel: "Serializable" });
  }
}
