import { registerSchema, type RegisterInput } from "./register.schema";
import type { ContaRepository } from "./conta.repository";

export class RegisterService {
  constructor(private readonly contaRepository: ContaRepository) {}

  async execute(input: RegisterInput) {
    const data = registerSchema.parse(input);

    return this.contaRepository.create(data);
  }
}
