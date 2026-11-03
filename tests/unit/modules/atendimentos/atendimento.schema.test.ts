import { describe, expect, it } from "vitest";
import { criarAtendimentoSchema, reagendarAtendimentoSchema, situacaoFichaSchema } from "../../../../src/modules/atendimentos/atendimento.schema";

describe("regras de atendimento", () => {
  const base = { pacienteId: 1, medicoId: 2, dataHoraPrevista: "2030-01-10T14:00:00Z", procedimento: "Exame de rotina" };

  it("aceita procedimento do catálogo compartilhado", () => {
    expect(criarAtendimentoSchema.safeParse(base).success).toBe(true);
  });

  it("exige horário e não aceita o atalho de início imediato", () => {
    const { dataHoraPrevista: _dataHoraPrevista, ...semHorario } = base;
    expect(criarAtendimentoSchema.safeParse(semHorario).success).toBe(false);
    expect(criarAtendimentoSchema.safeParse({ ...base, iniciarAgora: true }).success).toBe(false);
    expect(criarAtendimentoSchema.safeParse({ ...base, iniciarAgora: false }).success).toBe(false);
  });

  it("exige especificação para Outro", () => {
    expect(criarAtendimentoSchema.safeParse({ ...base, procedimento: "Outro" }).success).toBe(false);
    expect(criarAtendimentoSchema.safeParse({ ...base, procedimento: "Outro", procedimentoOutro: "Procedimento especial" }).success).toBe(true);
  });

  it("recusa procedimentos arbitrários", () => {
    expect(criarAtendimentoSchema.safeParse({ ...base, procedimento: "Personalizado" }).success).toBe(false);
  });

  it("valida motivo e data quando fora de tratamento", () => {
    expect(situacaoFichaSchema.safeParse({ situacao: "FORA_DE_TRATAMENTO", motivoEncerramento: "ALTA" }).success).toBe(false);
    expect(situacaoFichaSchema.safeParse({ situacao: "FORA_DE_TRATAMENTO", motivoEncerramento: "ALTA", dataEncerramento: "2030-01-10" }).success).toBe(true);
  });

  it("não aceita data inválida para reagendamento", () => {
    expect(reagendarAtendimentoSchema.safeParse({ dataHoraPrevista: "inválida" }).success).toBe(false);
  });
});
