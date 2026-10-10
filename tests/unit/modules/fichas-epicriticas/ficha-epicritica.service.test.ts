import { describe, expect, it } from "vitest";
import type { StatusFicha } from "../../../../src/generated/prisma/client";
import type {
  CriarFichaData,
  FichaEpicriticaRepository,
  FichaEpicriticaResumo,
} from "../../../../src/modules/fichas-epicriticas/ficha-epicritica.repository";
import type {
  AtualizarFichaEpicriticaData,
  ListarFichasEpicriticasFiltro,
  ReagendarFichaEpicriticaData,
} from "../../../../src/modules/fichas-epicriticas/ficha-epicritica.schema";
import { FichaEpicriticaService } from "../../../../src/modules/fichas-epicriticas/ficha-epicritica.service";

function ficha(status: StatusFicha = "AGENDADA"): FichaEpicriticaResumo {
  return {
    id: 1,
    pacienteId: 10,
    medicoId: 20,
    dataHoraPrevista: new Date("2030-01-01T12:00:00.000Z"),
    status,
    procedimento: null,
    observacoes: null,
    mecanismoLesao: null,
    dataInjuriaTraqueal: null,
    vocaliza: false,
    traqueostomizado: false,
    possuiComorbidades: false,
    comorbidadesDescricao: null,
    possuiSequelas: false,
    sequelasDescricao: null,
    usaMedicamentos: false,
    medicamentosDescricao: null,
    possuiLaringoscopia: false,
    achadoLaringoscopia: null,
    particularidades: null,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    inativadoEm: null,
    paciente: { id: 10, nome: "Paciente" },
    medico: { id: 20, crm: "123", conta: { nome: "Médica" } },
  };
}

class RepositoryFalso implements FichaEpicriticaRepository {
  atual = ficha();
  iniciou = false;

  async criar(data: CriarFichaData) {
    this.atual = { ...this.atual, ...data, procedimento: data.procedimento ?? null, observacoes: data.observacoes ?? null };
    return this.atual;
  }
  async listar(_filtro: ListarFichasEpicriticasFiltro) { return [this.atual]; }
  async buscarPorId(id: number) { return id === this.atual.id ? this.atual : null; }
  async pacienteExiste(id: number) { return id === 10; }
  async medicoAtivoExiste(id: number) { return id === 20; }
  async iniciarComHeranca(_id: number) {
    this.iniciou = true;
    this.atual = { ...this.atual, status: "EM_PREENCHIMENTO", possuiLaringoscopia: true };
    return this.atual;
  }
  async atualizarCamposClinicos(_id: number, data: AtualizarFichaEpicriticaData) {
    this.atual = { ...this.atual, ...data };
    return this.atual;
  }
  async reagendar(_id: number, data: ReagendarFichaEpicriticaData) {
    this.atual = { ...this.atual, ...data };
    return this.atual;
  }
  async alterarStatus(_id: number, _statusAtual: StatusFicha, novoStatus: StatusFicha) {
    this.atual = { ...this.atual, status: novoStatus };
    return this.atual;
  }
}

describe("FichaEpicriticaService", () => {
  it("cria uma ficha agendada sem aplicar herança antecipadamente", async () => {
    const repository = new RepositoryFalso();
    const service = new FichaEpicriticaService(repository);

    const criada = await service.criar({ pacienteId: 10, medicoId: 20 });

    expect(criada.status).toBe("AGENDADA");
    expect(repository.iniciou).toBe(false);
  });

  it("aplica a herança ao criar uma ficha para atendimento imediato", async () => {
    const repository = new RepositoryFalso();
    const service = new FichaEpicriticaService(repository);

    const criada = await service.criar({ pacienteId: 10, medicoId: 20, iniciarAgora: true });

    expect(criada.status).toBe("EM_PREENCHIMENTO");
    expect(criada.possuiLaringoscopia).toBe(true);
    expect(repository.iniciou).toBe(true);
  });

  it("rejeita edição clínica fora de EM_PREENCHIMENTO", async () => {
    const service = new FichaEpicriticaService(new RepositoryFalso());

    await expect(service.atualizar(1, { vocaliza: true })).rejects.toThrow(
      "Apenas fichas em preenchimento podem ser editadas",
    );
  });

  it("rejeita paciente inativo ou inexistente", async () => {
    const service = new FichaEpicriticaService(new RepositoryFalso());

    await expect(service.criar({ pacienteId: 999, medicoId: 20 })).rejects.toThrow(
      "Paciente não encontrado ou inativo",
    );
  });
});
