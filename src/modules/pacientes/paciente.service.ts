import { atualizarPacienteSchema, criarPacienteSchema, type AtualizarPacienteInput, type CriarPacienteInput } from "./paciente.schema";
import type { PacienteRepository } from "./paciente.repository";
import type { LocalidadeRepository } from "../localidades/localidade.repository";
import type { LogRepository } from "../logs/log.repository";
import type { Storage } from "../storage";

async function validarMunicipio(localidadeRepository: LocalidadeRepository, municipioId: number | undefined) {
  if (municipioId === undefined) return;
  const municipio = await localidadeRepository.buscarMunicipioPorCodigo(municipioId);
  if (!municipio) throw new Error("Município inválido");
}

export class CriarPacienteService {
  constructor(
    private readonly pacienteRepository: PacienteRepository,
    private readonly localidadeRepository: LocalidadeRepository,
    private readonly logRepository: LogRepository,
  ) {}

  async execute(input: CriarPacienteInput, atorId?: number) {
    const data = criarPacienteSchema.parse(input);
    await validarMunicipio(this.localidadeRepository, data.municipioId);
    const paciente = await this.pacienteRepository.create(data);

    await this.logRepository.criar({
      modulo: "PACIENTES",
      tipo: "PACIENTE_CRIADO",
      descricao: `Paciente cadastrado: ${paciente.nome}.`,
      atorId: atorId ?? null,
    });

    return paciente;
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

export class EnviarFotoPacienteService {
  constructor(
    private readonly pacienteRepository: PacienteRepository,
    private readonly storage: Storage,
    private readonly logRepository: LogRepository,
  ) {}

  async execute(id: number, arquivo: { buffer: Buffer; mimetype: string }, atorId?: number) {
    const atual = await this.pacienteRepository.buscarPorId(id);
    if (!atual) throw new Error("Paciente não encontrado");

    const { key } = await this.storage.upload({ folder: "pacientes", body: arquivo.buffer, contentType: arquivo.mimetype });

    if (atual.fotoChave) {
      await this.storage.delete(atual.fotoChave).catch((err) => console.error("Falha ao remover foto antiga:", err));
    }

    const atualizado = await this.pacienteRepository.atualizarFoto(id, key);

    await this.logRepository.criar({
      modulo: "PACIENTES",
      tipo: "PACIENTE_FOTO_ATUALIZADA",
      descricao: `Foto atualizada para o paciente: ${atualizado.nome}.`,
      atorId: atorId ?? null,
    });

    return atualizado;
  }
}
