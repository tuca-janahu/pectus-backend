import type { ContaRepository } from "./conta.repository";
import type { LogRepository } from "../logs/log.repository";
import type { Storage } from "../storage";

export class UpdateContaFotoService {
  constructor(
    private readonly contaRepository: ContaRepository,
    private readonly storage: Storage,
    private readonly logRepository: LogRepository,
  ) {}

  async execute(id: number, arquivo: { buffer: Buffer; mimetype: string }, atorId?: number) {
    const atual = await this.contaRepository.buscarPorId(id);
    if (!atual) throw new Error("Conta não encontrada");

    const { key } = await this.storage.upload({ folder: "contas", body: arquivo.buffer, contentType: arquivo.mimetype });

    if (atual.fotoChave) {
      await this.storage.delete(atual.fotoChave).catch((err) => console.error("Falha ao remover foto antiga:", err));
    }

    const atualizado = await this.contaRepository.atualizarFoto(id, key);

    await this.logRepository.criar({
      modulo: "USUARIOS",
      tipo: "USUARIO_FOTO_ATUALIZADA",
      descricao: `Foto atualizada para o usuário: ${atualizado.nome}.`,
      atorId: atorId ?? null,
    });

    return atualizado;
  }
}
