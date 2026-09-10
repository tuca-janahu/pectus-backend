import { describe, expect, it } from "vitest";

import { UpdateContaService } from "../../../../src/modules/contas/update-conta.service";
import type {
  AtualizarContaInput,
  ContaCriada,
  ContaRepository,
  ContaResumo,
} from "../../../../src/modules/contas/conta.repository";
import type { RegisterData } from "../../../../src/modules/contas/register.schema";

class ContaRepositoryFalso implements ContaRepository {
  contas = new Map<number, ContaResumo>();
  ultimaAtualizacao?: { id: number; input: AtualizarContaInput };

  async create(_data: RegisterData): Promise<ContaCriada> {
    throw new Error("nao usado neste teste");
  }

  async listar(): Promise<ContaResumo[]> {
    return [...this.contas.values()];
  }

  async buscarPorId(id: number): Promise<ContaResumo | null> {
    return this.contas.get(id) ?? null;
  }

  async atualizar(id: number, input: AtualizarContaInput): Promise<ContaResumo> {
    this.ultimaAtualizacao = { id, input };
    const atual = this.contas.get(id);
    if (!atual) throw new Error("Conta nao encontrada");
    const atualizado: ContaResumo = {
      ...atual,
      nome: input.nome ?? atual.nome,
      papeis: input.roles ? input.roles.map((papel) => ({ papel })) : atual.papeis,
      inativadoEm: input.ativo === undefined ? atual.inativadoEm : input.ativo ? null : new Date(),
    };
    this.contas.set(id, atualizado);
    return atualizado;
  }
}

function contaBase(overrides: Partial<ContaResumo> = {}): ContaResumo {
  return {
    id: 1,
    nome: "Ana",
    email: "ana@example.com",
    papeis: [{ papel: "ADMIN" }],
    medico: null,
    inativadoEm: null,
    ativada: true,
    criadoEm: new Date(),
    ...overrides,
  };
}

describe("UpdateContaService", () => {
  it("atualiza o nome de uma conta existente", async () => {
    const repository = new ContaRepositoryFalso();
    repository.contas.set(1, contaBase());
    const service = new UpdateContaService(repository);

    const resultado = await service.execute(1, { nome: "Ana Beatriz" });

    expect(resultado.nome).toBe("Ana Beatriz");
    expect(repository.ultimaAtualizacao?.input.nome).toBe("Ana Beatriz");
  });

  it("normaliza o crm para maiusculas ao atualizar", async () => {
    const repository = new ContaRepositoryFalso();
    repository.contas.set(1, contaBase());
    const service = new UpdateContaService(repository);

    await service.execute(1, { crm: "123456-ba" });

    expect(repository.ultimaAtualizacao?.input.crm).toBe("123456-BA");
  });

  it("rejeita lista de papeis vazia", async () => {
    const repository = new ContaRepositoryFalso();
    repository.contas.set(1, contaBase());
    const service = new UpdateContaService(repository);

    await expect(service.execute(1, { roles: [] })).rejects.toThrow();
  });

  it("permite desativar uma conta", async () => {
    const repository = new ContaRepositoryFalso();
    repository.contas.set(1, contaBase());
    const service = new UpdateContaService(repository);

    const resultado = await service.execute(1, { ativo: false });

    expect(resultado.inativadoEm).not.toBeNull();
  });
});
