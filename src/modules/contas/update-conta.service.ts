import { updateContaSchema, type UpdateContaInput } from "./update-conta.schema";
import type { ContaRepository } from "./conta.repository";
import type { LogRepository } from "../logs/log.repository";

export class UpdateContaService {
  constructor(
    private readonly contaRepository: ContaRepository,
    private readonly logRepository: LogRepository,
  ) {}

  async execute(id: number, input: UpdateContaInput, atorId?: number) {
    const data = updateContaSchema.parse(input);
    const conta = await this.contaRepository.atualizar(id, data);

    if (data.ativo !== undefined) {
      await this.logRepository.criar({
        modulo: "USUARIOS",
        tipo: data.ativo ? "USUARIO_ATIVADO_ADMIN" : "USUARIO_DESATIVADO_ADMIN",
        descricao: `Conta ${data.ativo ? "ativada" : "desativada"} pelo administrador: ${conta.nome} (${conta.email}).`,
        atorId: atorId ?? null,
      });
    }

    return conta;
  }
}
