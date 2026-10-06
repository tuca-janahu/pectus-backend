import { describe, expect, it } from "vitest";

import { UpdateContaFotoService } from "../../../../src/modules/contas/conta-foto.service";
import type { AtualizarContaInput, ContaCriada, ContaRepository, ContaResumo } from "../../../../src/modules/contas/conta.repository";
import type { RegisterData } from "../../../../src/modules/contas/register.schema";
import type { ListarLogsFiltro, LogRepository, RegistrarLogInput } from "../../../../src/modules/logs/log.repository";
import type { GetReadUrlInput, Storage, UploadInput, UploadResult } from "../../../../src/modules/storage";

class ContaRepositoryFalso implements ContaRepository {
  contas = new Map<number, ContaResumo>();
  fotosAtualizadas: { id: number; fotoChave: string | null }[] = [];

  async create(_data: RegisterData): Promise<ContaCriada> {
    throw new Error("nao usado neste teste");
  }

  async listar(): Promise<ContaResumo[]> {
    throw new Error("nao usado neste teste");
  }

  async buscarPorId(id: number): Promise<ContaResumo | null> {
    return this.contas.get(id) ?? null;
  }

  async atualizar(_id: number, _input: AtualizarContaInput): Promise<ContaResumo> {
    throw new Error("nao usado neste teste");
  }

  async atualizarFoto(id: number, fotoChave: string | null): Promise<ContaResumo> {
    this.fotosAtualizadas.push({ id, fotoChave });
    const atual = this.contas.get(id);
    if (!atual) throw new Error("Conta nao encontrada");
    const atualizado: ContaResumo = { ...atual, fotoChave };
    this.contas.set(id, atualizado);
    return atualizado;
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
  async delete(_key: string): Promise<void> {
    throw new Error("falha simulada ao deletar");
  }
}

function contaBase(overrides: Partial<ContaResumo> = {}): ContaResumo {
  return {
    id: 1,
    nome: "Ana",
    email: "ana@example.com",
    papeis: [{ papel: "ADMIN" }],
    medico: null,
    fotoChave: null,
    inativadoEm: null,
    ativada: true,
    criadoEm: new Date(),
    ...overrides,
  };
}

describe("UpdateContaFotoService", () => {
  it("envia a foto, persiste a chave e registra o log correspondente", async () => {
    const contaRepository = new ContaRepositoryFalso();
    contaRepository.contas.set(1, contaBase());
    const storage = new StorageFalso();
    const logRepository = new LogRepositoryFalso();
    const service = new UpdateContaFotoService(contaRepository, storage, logRepository);

    const atualizado = await service.execute(1, { buffer: Buffer.from("imagem"), mimetype: "image/jpeg" });

    expect(storage.uploads[0]).toMatchObject({ folder: "contas", contentType: "image/jpeg" });
    expect(atualizado.fotoChave).toBe("contas/gerada.jpg");
    expect(contaRepository.fotosAtualizadas[0]).toMatchObject({ id: 1, fotoChave: "contas/gerada.jpg" });
    expect(logRepository.registrados[0]).toMatchObject({ modulo: "USUARIOS", tipo: "USUARIO_FOTO_ATUALIZADA" });
  });

  it("remove a foto antiga do storage ao substituir por uma nova", async () => {
    const contaRepository = new ContaRepositoryFalso();
    contaRepository.contas.set(1, contaBase({ fotoChave: "contas/antiga.jpg" }));
    const storage = new StorageFalso();
    const service = new UpdateContaFotoService(contaRepository, storage, new LogRepositoryFalso());

    await service.execute(1, { buffer: Buffer.from("imagem"), mimetype: "image/jpeg" });

    expect(storage.deletados).toEqual(["contas/antiga.jpg"]);
  });

  it("conclui a troca de foto mesmo se a remoção da foto antiga falhar (best-effort)", async () => {
    const contaRepository = new ContaRepositoryFalso();
    contaRepository.contas.set(1, contaBase({ fotoChave: "contas/antiga.jpg" }));
    const storage = new StorageQueFalhaAoDeletar();
    const logRepository = new LogRepositoryFalso();
    const service = new UpdateContaFotoService(contaRepository, storage, logRepository);

    const atualizado = await service.execute(1, { buffer: Buffer.from("imagem"), mimetype: "image/jpeg" });

    expect(atualizado.fotoChave).toBe("contas/gerada.jpg");
    expect(logRepository.registrados).toHaveLength(1);
  });

  it("lança erro se a conta não existir", async () => {
    const contaRepository = new ContaRepositoryFalso();
    const storage = new StorageFalso();
    const service = new UpdateContaFotoService(contaRepository, storage, new LogRepositoryFalso());

    await expect(
      service.execute(999, { buffer: Buffer.from("imagem"), mimetype: "image/jpeg" }),
    ).rejects.toThrow("Conta não encontrada");
    expect(storage.uploads).toHaveLength(0);
  });
});
