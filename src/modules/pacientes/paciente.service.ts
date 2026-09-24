import { atualizarPacienteSchema, criarPacienteSchema, type AtualizarPacienteInput, type CriarPacienteInput } from "./paciente.schema";
import type { PacienteRepository } from "./paciente.repository";
import type { LocalidadeRepository } from "../localidades/localidade.repository";

async function validarMunicipio(localidadeRepository: LocalidadeRepository, municipioId: number | undefined) {
  if (municipioId === undefined) return;
  const municipio = await localidadeRepository.buscarMunicipioPorCodigo(municipioId);
  if (!municipio) throw new Error("Município inválido");
}

export class CriarPacienteService {
  constructor(
    private readonly pacienteRepository: PacienteRepository,
    private readonly localidadeRepository: LocalidadeRepository,
  ) {}

  async execute(input: CriarPacienteInput) {
    const data = criarPacienteSchema.parse(input);
    await validarMunicipio(this.localidadeRepository, data.municipioId);
    return this.pacienteRepository.create(data);
  }
}

export class ListarPacientesService {
  constructor(private readonly pacienteRepository: PacienteRepository) {}

  execute(filtro?: { nome?: string }) {
    return this.pacienteRepository.listar(filtro);
  }
}

export class BuscarPacienteService {
  constructor(private readonly pacienteRepository: PacienteRepository) {}

  async execute(id: number) {
    const paciente = await this.pacienteRepository.buscarPorId(id);
    if (!paciente) throw new Error("Paciente não encontrado");
    return paciente;
  }
}

export class AtualizarPacienteService {
  constructor(
    private readonly pacienteRepository: PacienteRepository,
    private readonly localidadeRepository: LocalidadeRepository,
  ) {}

  async execute(id: number, input: AtualizarPacienteInput) {
    const data = atualizarPacienteSchema.parse(input);
    await validarMunicipio(this.localidadeRepository, data.municipioId);
    return this.pacienteRepository.atualizar(id, data);
  }
}
