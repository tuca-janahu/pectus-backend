import {
  atualizarFichaEpicriticaSchema,
  criarFichaEpicriticaSchema,
  listarFichasEpicriticasSchema,
  reagendarFichaEpicriticaSchema,
  type AtualizarFichaEpicriticaInput,
  type CriarFichaEpicriticaInput,
  type ListarFichasEpicriticasInput,
  type ReagendarFichaEpicriticaInput,
} from "./ficha-epicritica.schema";
import type { FichaEpicriticaRepository } from "./ficha-epicritica.repository";

export class FichaEpicriticaService {
  constructor(private readonly repository: FichaEpicriticaRepository) {}

  async criar(input: CriarFichaEpicriticaInput) {
    const data = criarFichaEpicriticaSchema.parse(input);
    await this.validarPacienteEMedico(data.pacienteId, data.medicoId);

    const ficha = await this.repository.criar({
      pacienteId: data.pacienteId,
      medicoId: data.medicoId,
      dataHoraPrevista: data.dataHoraPrevista ?? new Date(),
      procedimento: data.procedimento,
      observacoes: data.observacoes,
    });
    if (!data.iniciarAgora) return ficha;

    return this.repository.iniciarComHeranca(ficha.id);
  }

  listar(input: ListarFichasEpicriticasInput) {
    return this.repository.listar(listarFichasEpicriticasSchema.parse(input));
  }

  async buscarPorId(id: number) {
    const ficha = await this.repository.buscarPorId(id);
    if (!ficha) throw new Error("Ficha epicrítica não encontrada");
    return ficha;
  }

  async iniciar(id: number) {
    await this.buscarPorId(id);
    return this.repository.iniciarComHeranca(id);
  }

  async atualizar(id: number, input: AtualizarFichaEpicriticaInput) {
    const data = atualizarFichaEpicriticaSchema.parse(input);
    const ficha = await this.buscarPorId(id);
    if (ficha.status !== "EM_PREENCHIMENTO") {
      throw new Error("Apenas fichas em preenchimento podem ser editadas");
    }
    return this.repository.atualizarCamposClinicos(id, data);
  }

  async reagendar(id: number, input: ReagendarFichaEpicriticaInput) {
    const data = reagendarFichaEpicriticaSchema.parse(input);
    const ficha = await this.buscarPorId(id);
    if (ficha.status !== "AGENDADA") throw new Error("Apenas fichas agendadas podem ser reagendadas");
    if (data.medicoId !== undefined && !(await this.repository.medicoAtivoExiste(data.medicoId))) {
      throw new Error("Médico não encontrado ou inativo");
    }
    return this.repository.reagendar(id, data);
  }

  async concluir(id: number) {
    const ficha = await this.buscarPorId(id);
    if (ficha.status !== "EM_PREENCHIMENTO") {
      throw new Error("Apenas fichas em preenchimento podem ser concluídas");
    }
    return this.repository.alterarStatus(id, "EM_PREENCHIMENTO", "CONCLUIDA");
  }

  async cancelar(id: number) {
    const ficha = await this.buscarPorId(id);
    if (ficha.status !== "AGENDADA" && ficha.status !== "EM_PREENCHIMENTO") {
      throw new Error("Apenas fichas abertas podem ser canceladas");
    }
    return this.repository.alterarStatus(id, ficha.status, "CANCELADA");
  }

  private async validarPacienteEMedico(pacienteId: number, medicoId: number) {
    if (!(await this.repository.pacienteExiste(pacienteId))) {
      throw new Error("Paciente não encontrado ou inativo");
    }
    if (!(await this.repository.medicoAtivoExiste(medicoId))) {
      throw new Error("Médico não encontrado ou inativo");
    }
  }
}
