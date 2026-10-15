import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_APPOINTMENT_DURATION_MINUTES,
  calcularDataTermino,
  GoogleCalendarService,
} from "../../../../src/modules/google-calendar";
import { FichaEpicriticaService } from "../../../../src/modules/fichas-epicriticas/ficha-epicritica.service";
import type { FichaEpicriticaRepository, FichaEpicriticaResumo } from "../../../../src/modules/fichas-epicriticas/ficha-epicritica.repository";

function criarFichaExemplo(): FichaEpicriticaResumo {
  return {
    id: 42,
    pacienteId: 10,
    medicoId: 20,
    dataHoraPrevista: new Date("2030-05-10T14:00:00.000Z"),
    status: "AGENDADA",
    procedimento: "Dilatação Traqueal",
    observacoes: "Paciente com estenose",
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
    googleEventId: null,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    inativadoEm: null,
    paciente: { id: 10, nome: "Carlos Eduardo" },
    medico: { id: 20, crm: "CRM/PA 12345", conta: { nome: "Dr. Roberto" } },
  };
}

class FakeRepository implements FichaEpicriticaRepository {
  ficha = criarFichaExemplo();

  async criar(data: any) {
    this.ficha = { ...this.ficha, ...data };
    return this.ficha;
  }
  async listar() { return [this.ficha]; }
  async buscarPorId(id: number) { return id === this.ficha.id ? this.ficha : null; }
  async pacienteExiste(id: number) { return id === 10; }
  async medicoAtivoExiste(id: number) { return id === 20; }
  async iniciarComHeranca() { return this.ficha; }
  async atualizarCamposClinicos(_id: number, data: any) {
    this.ficha = { ...this.ficha, ...data };
    return this.ficha;
  }
  async reagendar(_id: number, data: any) {
    this.ficha = { ...this.ficha, ...data };
    return this.ficha;
  }
  async alterarStatus(_id: number, _atual: any, novo: any) {
    this.ficha = { ...this.ficha, status: novo };
    return this.ficha;
  }
  async atualizarGoogleEventId(_id: number, googleEventId: string | null) {
    this.ficha = { ...this.ficha, googleEventId };
  }
}

describe("GoogleCalendarService & Integração de Agendamentos", () => {
  describe("Regra de Duração do Agendamento", () => {
    it("deve possuir a duração padrão de 60 minutos", () => {
      expect(DEFAULT_APPOINTMENT_DURATION_MINUTES).toBe(60);
    });

    it("deve calcular o término do evento adicionando exatamente 60 minutos à data de início", () => {
      const inicio = new Date("2026-10-15T09:00:00.000Z");
      const termino = calcularDataTermino(inicio);

      const diferencaMinutos = (termino.getTime() - inicio.getTime()) / (1000 * 60);
      expect(diferencaMinutos).toBe(60);
      expect(termino.toISOString()).toBe("2026-10-15T10:00:00.000Z");
    });

    it("deve permitir duração customizada se fornecida", () => {
      const inicio = new Date("2026-10-15T09:00:00.000Z");
      const termino = calcularDataTermino(inicio, 90);

      const diferencaMinutos = (termino.getTime() - inicio.getTime()) / (1000 * 60);
      expect(diferencaMinutos).toBe(90);
    });
  });

  describe("Arquitetura Fail-Safe e Desacoplamento no FichaEpicriticaService", () => {
    it("cria a ficha com sucesso mesmo se a API do Google Calendar lançar exceção", async () => {
      const fakeRepo = new FakeRepository();
      const mockCalendarService = new GoogleCalendarService();

      // Simula falha catastrófica da API do Google (ex: timeout de rede ou serviço indisponível)
      vi.spyOn(mockCalendarService, "criarEventoParaFicha").mockRejectedValue(
        new Error("Google Calendar API 503 Service Unavailable"),
      );

      const service = new FichaEpicriticaService(fakeRepo, mockCalendarService);

      // A criação da ficha NÃO deve falhar!
      const resultado = await service.criar({
        pacienteId: 10,
        medicoId: 20,
        procedimento: "Traqueoplastia de Urgência",
      });

      expect(resultado).toBeDefined();
      expect(resultado.id).toBe(42);
      expect(resultado.status).toBe("AGENDADA");
      expect(mockCalendarService.criarEventoParaFicha).toHaveBeenCalledWith(42);
    });

    it("aciona a sincronização de atualização ao reagendar ficha", async () => {
      const fakeRepo = new FakeRepository();
      const mockCalendarService = new GoogleCalendarService();
      const spyAtualizar = vi
        .spyOn(mockCalendarService, "atualizarEventoParaFicha")
        .mockResolvedValue();

      const service = new FichaEpicriticaService(fakeRepo, mockCalendarService);

      await service.reagendar(42, {
        dataHoraPrevista: new Date("2030-06-01T15:00:00.000Z"),
      });

      expect(spyAtualizar).toHaveBeenCalledWith(42);
    });

    it("aciona a remoção do evento ao cancelar ficha agendada", async () => {
      const fakeRepo = new FakeRepository();
      const mockCalendarService = new GoogleCalendarService();
      const spyRemover = vi
        .spyOn(mockCalendarService, "removerEventoParaFicha")
        .mockResolvedValue();

      const service = new FichaEpicriticaService(fakeRepo, mockCalendarService);

      await service.cancelar(42);

      expect(spyRemover).toHaveBeenCalledWith(42);
    });
  });
});
