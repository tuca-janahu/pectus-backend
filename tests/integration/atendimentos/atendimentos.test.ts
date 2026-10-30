import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient } from "../../../src/db/prisma";
import { AtendimentoService } from "../../../src/modules/atendimentos/atendimento.service";

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
    expect((await service.fichaDoPaciente(paciente.id)).situacao).toBe("EM_TRATAMENTO");
    await service.iniciar(segundo.id, responsavel);
    await service.alterarSituacao(segundo.id, { situacao: "FORA_DE_TRATAMENTO", motivoEncerramento: "OBITO", dataEncerramento: "2030-01-11" }, responsavel);
    await expect(service.criar({ pacienteId: paciente.id, medicoId: responsavel.medico.id, dataHoraPrevista: "2030-01-12T14:00:00Z", procedimento: "Exame de rotina" }, responsavel)).rejects.toMatchObject({ status: 409 });
  });
});
