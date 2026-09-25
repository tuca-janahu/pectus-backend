import { describe, expect, it } from "vitest";

import {
  AtualizarPacienteService,
  CriarPacienteService,
} from "../../../../src/modules/pacientes/paciente.service";
import type {
  AtualizarPacienteData,
  CriarPacienteData,
} from "../../../../src/modules/pacientes/paciente.schema";
import type { PacienteRepository, PacienteResumo } from "../../../../src/modules/pacientes/paciente.repository";
import type {
  EstadoResumo,
  LocalidadeRepository,
  MunicipioResumo,
} from "../../../../src/modules/localidades/localidade.repository";
import type {
  ListarLogsFiltro,
  LogRepository,
  RegistrarLogInput,
} from "../../../../src/modules/logs/log.repository";

class PacienteRepositoryFalso implements PacienteRepository {
  criados: CriarPacienteData[] = [];
  atualizados: { id: number; input: AtualizarPacienteData }[] = [];

  async create(data: CriarPacienteData): Promise<PacienteResumo> {
    this.criados.push(data);
    return {
      id: 1,
      nome: data.nome,
      cpf: data.cpf ?? null,
      dataNascimento: data.dataNascimento,
      genero: data.genero,
      municipio: null,
      telefones: data.telefones.map((telefone) => ({ telefone })),
      inativadoEm: null,
      criadoEm: new Date(),
    };
  }

  async listar(): Promise<PacienteResumo[]> {
    throw new Error("não usado neste teste");
  }

  async buscarPorId(): Promise<PacienteResumo | null> {
    throw new Error("não usado neste teste");
  }

  async atualizar(id: number, input: AtualizarPacienteData): Promise<PacienteResumo> {
    this.atualizados.push({ id, input });
    return {
      id,
      nome: input.nome ?? "Paciente",
      cpf: null,
      dataNascimento: new Date(),
      genero: input.genero ?? "",
      municipio: null,
      telefones: [],
      inativadoEm: input.ativo === false ? new Date() : null,
      criadoEm: new Date(),
    };
  }
}

class LocalidadeRepositoryFalsa implements LocalidadeRepository {
  municipioValido: MunicipioResumo | null = null;

  async listarEstados(): Promise<EstadoResumo[]> {
    throw new Error("não usado neste teste");
  }

  async listarMunicipiosPorEstado(): Promise<MunicipioResumo[]> {
    throw new Error("não usado neste teste");
  }

  async buscarMunicipioPorCodigo(codigo: number) {
    return this.municipioValido?.codigo === codigo ? this.municipioValido : null;
  }

  async atualizarMunicipio(): Promise<MunicipioResumo> {
    throw new Error("não usado neste teste");
  }
}

class LogRepositoryFalso implements LogRepository {
  registrados: RegistrarLogInput[] = [];

  async criar(input: RegistrarLogInput) {
    this.registrados.push(input);
  }

  async listar(_filtro: ListarLogsFiltro) {
    throw new Error("não usado neste teste");
  }
}

describe("CriarPacienteService", () => {
  it("cria um paciente sem município informado e registra o log correspondente", async () => {
    const pacienteRepository = new PacienteRepositoryFalso();
    const localidadeRepository = new LocalidadeRepositoryFalsa();
    const logRepository = new LogRepositoryFalso();
    const service = new CriarPacienteService(pacienteRepository, localidadeRepository, logRepository);

    const paciente = await service.execute({
      nome: "Ana",
      dataNascimento: "1990-01-01",
      genero: "feminino",
    });

    expect(paciente.nome).toBe("Ana");
    expect(pacienteRepository.criados).toHaveLength(1);
    expect(logRepository.registrados).toHaveLength(1);
    expect(logRepository.registrados[0]).toMatchObject({ modulo: "PACIENTES", tipo: "PACIENTE_CRIADO" });
  });

  it("cria um paciente com município válido", async () => {
    const pacienteRepository = new PacienteRepositoryFalso();
    const localidadeRepository = new LocalidadeRepositoryFalsa();
    localidadeRepository.municipioValido = { codigo: 1501402, nome: "Belém", estadoCodigo: 15, pertenceRmBelem: true };
    const service = new CriarPacienteService(pacienteRepository, localidadeRepository, new LogRepositoryFalso());

    await service.execute({
      nome: "Ana",
      dataNascimento: "1990-01-01",
      genero: "feminino",
      municipioId: 1501402,
    });

    expect(pacienteRepository.criados[0].municipioId).toBe(1501402);
  });

  it("rejeita municipioId inválido sem chamar o repositório de pacientes", async () => {
    const pacienteRepository = new PacienteRepositoryFalso();
    const localidadeRepository = new LocalidadeRepositoryFalsa();
    const logRepository = new LogRepositoryFalso();
    const service = new CriarPacienteService(pacienteRepository, localidadeRepository, logRepository);

    await expect(
      service.execute({
        nome: "Ana",
        dataNascimento: "1990-01-01",
        genero: "feminino",
        municipioId: 999999,
      }),
    ).rejects.toThrow("Município inválido");

    expect(pacienteRepository.criados).toHaveLength(0);
    expect(logRepository.registrados).toHaveLength(0);
  });
});

describe("AtualizarPacienteService", () => {
  it("rejeita municipioId inválido na atualização", async () => {
    const pacienteRepository = new PacienteRepositoryFalso();
    const localidadeRepository = new LocalidadeRepositoryFalsa();
    const service = new AtualizarPacienteService(pacienteRepository, localidadeRepository);

    await expect(service.execute(1, { municipioId: 999999 })).rejects.toThrow("Município inválido");
    expect(pacienteRepository.atualizados).toHaveLength(0);
  });

  it("desativa um paciente", async () => {
    const pacienteRepository = new PacienteRepositoryFalso();
    const localidadeRepository = new LocalidadeRepositoryFalsa();
    const service = new AtualizarPacienteService(pacienteRepository, localidadeRepository);

    const resultado = await service.execute(1, { ativo: false });

    expect(resultado.inativadoEm).not.toBeNull();
  });

  it("não envia telefones ao repositório quando a atualização não os menciona", async () => {
    const pacienteRepository = new PacienteRepositoryFalso();
    const localidadeRepository = new LocalidadeRepositoryFalsa();
    const service = new AtualizarPacienteService(pacienteRepository, localidadeRepository);

    await service.execute(1, { nome: "Novo nome" });

    expect(pacienteRepository.atualizados[0].input.telefones).toBeUndefined();
  });
});
