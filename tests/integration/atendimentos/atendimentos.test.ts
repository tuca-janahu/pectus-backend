import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createPrismaClient } from "../../../src/db/prisma";
import { AtendimentoService } from "../../../src/modules/atendimentos/atendimento.service";
import { googleCalendarService } from "../../../src/modules/google-calendar/google-calendar.service";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL de teste não configurada");
const db = createPrismaClient(databaseUrl);
const service = new AtendimentoService(db);

async function medico(sufixo: string) {
  const conta = await db.conta.create({ data: {
    nome: `Médico ${sufixo}`, email: `medico-${sufixo}@example.test`,
    papeis: { create: { papel: "MEDICO" } },
    medico: { create: { crm: `CRM-${sufixo}` } },
  }, include: { medico: true } });
  return { id: conta.id, roles: ["MEDICO"], medico: { id: conta.medico!.id } };
}

describe("Atendimentos longitudinais (integração)", () => {
  beforeAll(async () => { await db.$connect(); });
  afterEach(async () => {
    await db.midiaAtendimento.deleteMany();
    await db.atendimento.deleteMany();
    await db.ficha.deleteMany();
    await db.paciente.deleteMany();
    await db.medico.deleteMany();
    await db.contaPapel.deleteMany();
    await db.conta.deleteMany();
  });
  afterAll(async () => { await db.$disconnect(); });

  it("usa uma ficha única, impede sobreposição e permite correção por outro médico", async () => {
    const paciente = await db.paciente.create({ data: {
      nome: "Paciente de teste", dataNascimento: new Date("1990-01-01"), genero: "OUTRO",
      ficha: { create: {} },
    } });
    const primeiro = await medico("a");
    const segundo = await medico("b");
    const inicio = new Date("2030-01-10T14:00:00Z");
    const criado = await service.criar({ pacienteId: paciente.id, medicoId: primeiro.medico.id, dataHoraPrevista: inicio, procedimento: "Exame de rotina" }, primeiro);
    await expect(service.criar({ pacienteId: paciente.id, medicoId: segundo.medico.id, dataHoraPrevista: "2030-01-10T14:30:00Z", procedimento: "Broncoscopia" }, segundo)).rejects.toMatchObject({ status: 409 });
    await service.criar({ pacienteId: paciente.id, medicoId: segundo.medico.id, dataHoraPrevista: "2030-01-10T15:00:00Z", procedimento: "Broncoscopia" }, segundo);
    const outroPaciente = await db.paciente.create({ data: {
      nome: "Outro paciente", dataNascimento: new Date("1991-01-01"), genero: "OUTRO", ficha: { create: {} },
    } });
    await expect(service.criar({ pacienteId: outroPaciente.id, medicoId: primeiro.medico.id, dataHoraPrevista: "2030-01-10T14:30:00Z", procedimento: "Exame de rotina" }, primeiro)).rejects.toMatchObject({ status: 409 });
    expect(await db.ficha.count({ where: { pacienteId: paciente.id } })).toBe(1);
    expect(await db.atendimento.count({ where: { ficha: { pacienteId: paciente.id } } })).toBe(2);

    await service.iniciar(criado.id, primeiro);
    await service.atualizar(criado.id, { clinico: { dataInjuriaTraqueal: "2025-01-01", traqueostomizado: false } }, primeiro);
    await service.concluir(criado.id, primeiro);
    const corrigido = await service.atualizar(criado.id, { observacoes: "Correção clínica", clinico: { traqueostomizado: true } }, segundo, true);
    expect(corrigido.ficha.traqueostomizado).toBe(true);
    expect(corrigido.historico).toEqual(expect.arrayContaining([expect.objectContaining({ tipo: "ATENDIMENTO_CORRIGIDO", autorContaId: segundo.id })]));
  });

  it("mantém cancelamento definitivo sem ocupar o horário", async () => {
    const paciente = await db.paciente.create({ data: {
      nome: "Paciente cancelamento", dataNascimento: new Date("1990-01-01"), genero: "OUTRO", ficha: { create: {} },
    } });
    const responsavel = await medico("cancelamento");
    const agendado = await service.criar({ pacienteId: paciente.id, medicoId: responsavel.medico.id, dataHoraPrevista: "2030-01-10T14:00:00Z", procedimento: "Exame de rotina" }, responsavel);
    await service.cancelar(agendado.id, responsavel);
    await expect(service.iniciar(agendado.id, responsavel)).rejects.toMatchObject({ status: 409 });
    const novo = await service.criar({ pacienteId: paciente.id, medicoId: responsavel.medico.id, dataHoraPrevista: "2030-01-10T14:00:00Z", procedimento: "Exame de rotina" }, responsavel);
    expect(novo.id).not.toBe(agendado.id);
  });

  it("reativa após alta e bloqueia novos atendimentos após óbito", async () => {
    const paciente = await db.paciente.create({ data: {
      nome: "Paciente situação", dataNascimento: new Date("1990-01-01"), genero: "OUTRO", ficha: { create: {} },
    } });
    const responsavel = await medico("situacao");
    const primeiro = await service.criar({ pacienteId: paciente.id, medicoId: responsavel.medico.id, dataHoraPrevista: "2030-01-10T14:00:00Z", procedimento: "Exame de rotina" }, responsavel);
    await service.iniciar(primeiro.id, responsavel);
    await service.alterarSituacao(primeiro.id, { situacao: "FORA_DE_TRATAMENTO", motivoEncerramento: "ALTA", dataEncerramento: "2030-01-10" }, responsavel);
    const segundo = await service.criar({ pacienteId: paciente.id, medicoId: responsavel.medico.id, dataHoraPrevista: "2030-01-11T14:00:00Z", procedimento: "Exame de rotina" }, responsavel);
    expect((await service.fichaDoPaciente(paciente.id)).situacao).toBe("FORA_DE_TRATAMENTO");
    await service.iniciar(segundo.id, responsavel);
    expect((await service.fichaDoPaciente(paciente.id)).situacao).toBe("EM_TRATAMENTO");
    await service.alterarSituacao(segundo.id, { situacao: "FORA_DE_TRATAMENTO", motivoEncerramento: "OBITO", dataEncerramento: "2030-01-11" }, responsavel);
    await expect(service.criar({ pacienteId: paciente.id, medicoId: responsavel.medico.id, dataHoraPrevista: "2030-01-12T14:00:00Z", procedimento: "Exame de rotina" }, responsavel)).rejects.toMatchObject({ status: 409 });
  });

  it("não reativa a ficha quando o retorno agendado após alta é cancelado", async () => {
    const paciente = await db.paciente.create({ data: {
      nome: "Paciente retorno cancelado", dataNascimento: new Date("1990-01-01"), genero: "OUTRO", ficha: { create: {} },
    } });
    const responsavel = await medico("retorno-cancelado");
    const primeiro = await service.criar({ pacienteId: paciente.id, medicoId: responsavel.medico.id,
      dataHoraPrevista: "2030-01-10T14:00:00Z", procedimento: "Exame de rotina" }, responsavel);
    await service.iniciar(primeiro.id, responsavel);
    await service.alterarSituacao(primeiro.id, { situacao: "FORA_DE_TRATAMENTO", motivoEncerramento: "ALTA", dataEncerramento: "2030-01-10" }, responsavel);
    const retorno = await service.criar({ pacienteId: paciente.id, medicoId: responsavel.medico.id,
      dataHoraPrevista: "2030-01-11T14:00:00Z", procedimento: "Exame de rotina" }, responsavel);
    await service.cancelar(retorno.id, responsavel);
    const ficha = await service.fichaDoPaciente(paciente.id);
    expect(ficha.situacao).toBe("FORA_DE_TRATAMENTO");
    expect(ficha.motivoEncerramento).toBe("ALTA");
  });

  it("permite corrigir dados da visita antiga, mas não reescrever a ficha após atendimento posterior", async () => {
    const paciente = await db.paciente.create({ data: {
      nome: "Paciente correção", dataNascimento: new Date("1990-01-01"), genero: "OUTRO", ficha: { create: {} },
    } });
    const primeiroMedico = await medico("correcao-a");
    const segundoMedico = await medico("correcao-b");
    const primeiro = await service.criar({ pacienteId: paciente.id, medicoId: primeiroMedico.medico.id,
      dataHoraPrevista: "2030-01-10T14:00:00Z", procedimento: "Exame de rotina" }, primeiroMedico);
    await service.iniciar(primeiro.id, primeiroMedico);
    await service.atualizar(primeiro.id, { clinico: { dataInjuriaTraqueal: "2025-01-01" } }, primeiroMedico);
    await service.concluir(primeiro.id, primeiroMedico);
    const posterior = await service.criar({ pacienteId: paciente.id, medicoId: segundoMedico.medico.id,
      dataHoraPrevista: "2030-01-11T14:00:00Z", procedimento: "Broncoscopia" }, segundoMedico);
    await service.iniciar(posterior.id, segundoMedico);
    await service.concluir(posterior.id, segundoMedico);

    const corrigido = await service.atualizar(primeiro.id, { observacoes: "Correção retrospectiva" }, segundoMedico, true);
    expect(corrigido.observacoes).toBe("Correção retrospectiva");
    await expect(service.atualizar(primeiro.id, { clinico: { traqueostomizado: true } }, segundoMedico, true))
      .rejects.toMatchObject({ status: 409 });
    const atual = await service.atualizar(posterior.id, { clinico: { traqueostomizado: true } }, primeiroMedico, true);
    expect(atual.ficha.traqueostomizado).toBe(true);
  });

  it("bloqueia iniciar ou cancelar agendamento de outro médico", async () => {
    const paciente = await db.paciente.create({ data: {
      nome: "Paciente permissão", dataNascimento: new Date("1990-01-01"), genero: "OUTRO", ficha: { create: {} },
    } });
    const responsavel = await medico("permissao-a");
    const outro = await medico("permissao-b");
    const atendimento = await service.criar({ pacienteId: paciente.id, medicoId: responsavel.medico.id,
      dataHoraPrevista: "2030-01-10T14:00:00Z", procedimento: "Exame de rotina", observacoes: "Trazer exames" }, responsavel);
    expect((await service.listar({ pacienteId: paciente.id }))[0].observacoes).toBe("Trazer exames");
    await expect(service.iniciar(atendimento.id, outro)).rejects.toMatchObject({ status: 403 });
    await expect(service.cancelar(atendimento.id, outro)).rejects.toMatchObject({ status: 403 });
    expect((await service.buscarPorId(atendimento.id)).status).toBe("AGENDADA");
  });

  it("serializa agendamentos concorrentes para o mesmo paciente", async () => {
    const paciente = await db.paciente.create({ data: {
      nome: "Paciente concorrência", dataNascimento: new Date("1990-01-01"), genero: "OUTRO", ficha: { create: {} },
    } });
    const primeiro = await medico("concorrencia-a");
    const segundo = await medico("concorrencia-b");
    const resultados = await Promise.allSettled([
      service.criar({ pacienteId: paciente.id, medicoId: primeiro.medico.id,
        dataHoraPrevista: "2030-01-10T14:00:00Z", procedimento: "Exame de rotina" }, primeiro),
      service.criar({ pacienteId: paciente.id, medicoId: segundo.medico.id,
        dataHoraPrevista: "2030-01-10T14:30:00Z", procedimento: "Broncoscopia" }, segundo),
    ]);
    expect(resultados.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(await db.atendimento.count({ where: { ficha: { pacienteId: paciente.id } } })).toBe(1);
  });

  it("usa a transferência de calendário ao trocar o médico responsável", async () => {
    const paciente = await db.paciente.create({ data: {
      nome: "Paciente transferência", dataNascimento: new Date("1990-01-01"), genero: "OUTRO", ficha: { create: {} },
    } });
    const primeiro = await medico("transferencia-a");
    const segundo = await medico("transferencia-b");
    const agendado = await service.criar({ pacienteId: paciente.id, medicoId: primeiro.medico.id,
      dataHoraPrevista: "2030-01-10T14:00:00Z", procedimento: "Exame de rotina" }, primeiro);
    await db.atendimento.update({ where: { id: agendado.id }, data: { googleEventId: "evento-anterior" } });
    const transferir = vi.spyOn(googleCalendarService, "transferirEventoParaAtendimento").mockResolvedValue();
    try {
      const atualizado = await service.reagendar(agendado.id, { medicoId: segundo.medico.id },
        { id: primeiro.id, roles: ["ADMIN"], medico: null });
      expect(atualizado.medicoId).toBe(segundo.medico.id);
      expect(transferir).toHaveBeenCalledWith(agendado.id, primeiro.id, "evento-anterior");
    } finally {
      transferir.mockRestore();
    }
  });
});
