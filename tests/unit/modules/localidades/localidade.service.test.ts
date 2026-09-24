import { describe, expect, it } from "vitest";

import { LocalidadeService } from "../../../../src/modules/localidades/localidade.service";
import type {
  EstadoResumo,
  LocalidadeRepository,
  MunicipioResumo,
} from "../../../../src/modules/localidades/localidade.repository";

class LocalidadeRepositoryFalsa implements LocalidadeRepository {
  estados: EstadoResumo[] = [];
  municipios: MunicipioResumo[] = [];
  atualizacoes: { codigo: number; pertenceRmBelem: boolean }[] = [];

  async listarEstados() {
    return this.estados;
  }

  async listarMunicipiosPorEstado(estadoCodigo: number) {
    return this.municipios.filter((m) => m.estadoCodigo === estadoCodigo);
  }

  async buscarMunicipioPorCodigo(codigo: number) {
    return this.municipios.find((m) => m.codigo === codigo) ?? null;
  }

  async atualizarMunicipio(codigo: number, input: { pertenceRmBelem: boolean }) {
    this.atualizacoes.push({ codigo, ...input });
    const municipio = this.municipios.find((m) => m.codigo === codigo);
    if (!municipio) throw new Error("não deveria chegar aqui");
    municipio.pertenceRmBelem = input.pertenceRmBelem;
    return municipio;
  }
}

describe("LocalidadeService", () => {
  it("lista municípios filtrando pelo estado", async () => {
    const repository = new LocalidadeRepositoryFalsa();
    repository.municipios = [
      { codigo: 1501402, nome: "Belém", estadoCodigo: 15, pertenceRmBelem: true },
      { codigo: 3550308, nome: "São Paulo", estadoCodigo: 35, pertenceRmBelem: false },
    ];
    const service = new LocalidadeService(repository);

    const resultado = await service.listarMunicipios(15);

    expect(resultado).toHaveLength(1);
    expect(resultado[0].nome).toBe("Belém");
  });

  it("atualiza o flag pertenceRmBelem de um município existente", async () => {
    const repository = new LocalidadeRepositoryFalsa();
    repository.municipios = [{ codigo: 1502400, nome: "Castanhal", estadoCodigo: 15, pertenceRmBelem: false }];
    const service = new LocalidadeService(repository);

    const resultado = await service.atualizarMunicipio(1502400, { pertenceRmBelem: true });

    expect(resultado.pertenceRmBelem).toBe(true);
    expect(repository.atualizacoes).toEqual([{ codigo: 1502400, pertenceRmBelem: true }]);
  });

  it("rejeita atualizar um município desconhecido", async () => {
    const repository = new LocalidadeRepositoryFalsa();
    const service = new LocalidadeService(repository);

    await expect(service.atualizarMunicipio(999999, { pertenceRmBelem: true })).rejects.toThrow(
      "Município não encontrado",
    );
  });
});
