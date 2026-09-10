import { updateContaSchema, type UpdateContaInput } from "./update-conta.schema";
import type { ContaRepository } from "./conta.repository";

export class UpdateContaService {
  constructor(private readonly contaRepository: ContaRepository) {}

  async execute(id: number, input: UpdateContaInput) {
    const data = updateContaSchema.parse(input);
    return this.contaRepository.atualizar(id, data);
  }
}
