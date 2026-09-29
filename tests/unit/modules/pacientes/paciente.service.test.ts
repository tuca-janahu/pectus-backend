import { describe, expect, it } from "vitest";

import {
  AtualizarPacienteService,
  CriarPacienteService,
  EnviarFotoPacienteService,
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
import type { GetReadUrlInput, Storage, UploadInput, UploadResult } from "../../../../src/modules/storage";

class PacienteRepositoryFalso implements PacienteRepository {
  criados: CriarPacienteData[] = [];
  atualizados: { id: number; input: AtualizarPacienteData }[] = [];
  fotosAtualizadas: { id: number; fotoChave: string | null }[] = [];
  pacientes = new Map<number, PacienteResumo>();

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
      fotoChave: null,
      inativadoEm: null,
      criadoEm: new Date(),
    };
  }

  async listar(): Promise<PacienteResumo[]> {
    throw new Error("não usado neste teste");
  }

  async buscarPorId(id: number): Promise<PacienteResumo | null> {
    return this.pacientes.get(id) ?? null;
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
      fotoChave: null,
      inativadoEm: input.ativo === false ? new Date() : null,
      criadoEm: new Date(),
    };
  }

  async atualizarFoto(id: number, fotoChave: string | null): Promise<PacienteResumo> {
    this.fotosAtualizadas.push({ id, fotoChave });
    const atual = this.pacientes.get(id);
    const atualizado: PacienteResumo = atual
      ? { ...atual, fotoChave }
      : {
          id,
          nome: "Paciente",
          cpf: null,
          dataNascimento: new Date(),
          genero: "",
          municipio: null,
          telefones: [],
          fotoChave,
          inativadoEm: null,
          criadoEm: new Date(),
        };
    this.pacientes.set(id, atualizado);
    return atualizado;
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

class StorageFalso implements Storage {
  uploads: UploadInput[] = [];
  deletados: string[] = [];

  async upload(input: UploadInput): Promise<UploadResult> {
    this.uploads.push(input);
    return { key: `${input.folder}/gerada.jpg` };
  }

  async getReadUrl(_input: GetReadUrlInput): Promise<string> {
    return "https://storage.falso/url-assinada";
  }

  async delete(key: string): Promise<void> {
    this.deletados.push(key);
  }
}

class StorageQueFalhaAoDeletar extends StorageFalso {
  async delete(key: string): Promise<void> {
    throw new Error("falha simulada ao deletar");
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

describe("EnviarFotoPacienteService", () => {
  function pacienteBase(overrides: Partial<PacienteResumo> = {}): PacienteResumo {
    return {
      id: 1,
      nome: "Ana",
      cpf: null,
      dataNascimento: new Date("1990-01-01"),
      genero: "feminino",
      municipio: null,
      telefones: [],
      fotoChave: null,
      inativadoEm: null,
      criadoEm: new Date(),
      ...overrides,
    };
  }

  it("envia a foto, persiste a chave e registra o log correspondente", async () => {
    const pacienteRepository = new PacienteRepositoryFalso();
    pacienteRepository.pacientes.set(1, pacienteBase());
    const storage = new StorageFalso();
    const logRepository = new LogRepositoryFalso();
    const service = new EnviarFotoPacienteService(pacienteRepository, storage, logRepository);

    const atualizado = await service.execute(1, { buffer: Buffer.from("imagem"), mimetype: "image/jpeg" });

    expect(storage.uploads[0]).toMatchObject({ folder: "pacientes", contentType: "image/jpeg" });
    expect(atualizado.fotoChave).toBe("pacientes/gerada.jpg");
    expect(pacienteRepository.fotosAtualizadas[0]).toMatchObject({ id: 1, fotoChave: "pacientes/gerada.jpg" });
    expect(logRepository.registrados[0]).toMatchObject({ modulo: "PACIENTES", tipo: "PACIENTE_FOTO_ATUALIZADA" });
  });

  it("remove a foto antiga do storage ao substituir por uma nova", async () => {
    const pacienteRepository = new PacienteRepositoryFalso();
    pacienteRepository.pacientes.set(1, pacienteBase({ fotoChave: "pacientes/antiga.jpg" }));
    const storage = new StorageFalso();
    const service = new EnviarFotoPacienteService(pacienteRepository, storage, new LogRepositoryFalso());

    await service.execute(1, { buffer: Buffer.from("imagem"), mimetype: "image/jpeg" });

    expect(storage.deletados).toEqual(["pacientes/antiga.jpg"]);
  });

  it("conclui a troca de foto mesmo se a remoção da foto antiga falhar (best-effort)", async () => {
    const pacienteRepository = new PacienteRepositoryFalso();
    pacienteRepository.pacientes.set(1, pacienteBase({ fotoChave: "pacientes/antiga.jpg" }));
    const storage = new StorageQueFalhaAoDeletar();
    const logRepository = new LogRepositoryFalso();
    const service = new EnviarFotoPacienteService(pacienteRepository, storage, logRepository);

    const atualizado = await service.execute(1, { buffer: Buffer.from("imagem"), mimetype: "image/jpeg" });

    expect(atualizado.fotoChave).toBe("pacientes/gerada.jpg");
    expect(logRepository.registrados).toHaveLength(1);
  });

  it("lança erro se o paciente não existir", async () => {
    const pacienteRepository = new PacienteRepositoryFalso();
    const storage = new StorageFalso();
    const service = new EnviarFotoPacienteService(pacienteRepository, storage, new LogRepositoryFalso());

    await expect(
      service.execute(999, { buffer: Buffer.from("imagem"), mimetype: "image/jpeg" }),
    ).rejects.toThrow("Paciente não encontrado");
    expect(storage.uploads).toHaveLength(0);
  });
});
