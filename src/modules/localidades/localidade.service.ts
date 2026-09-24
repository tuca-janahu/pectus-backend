import { updateMunicipioSchema, type UpdateMunicipioInput } from "./update-municipio.schema";
import type { LocalidadeRepository } from "./localidade.repository";

export class LocalidadeService {
  constructor(private readonly localidadeRepository: LocalidadeRepository) {}

  listarEstados() {
    return this.localidadeRepository.listarEstados();
  }

  listarMunicipios(estadoCodigo: number) {
    return this.localidadeRepository.listarMunicipiosPorEstado(estadoCodigo);
  }

  async atualizarMunicipio(codigo: number, input: UpdateMunicipioInput) {
    const data = updateMunicipioSchema.parse(input);
    const existente = await this.localidadeRepository.buscarMunicipioPorCodigo(codigo);
    if (!existente) throw new Error("Município não encontrado");
    return this.localidadeRepository.atualizarMunicipio(codigo, data);
  }
}
