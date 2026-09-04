import { describe, expect, it } from "vitest";

import { RegisterService } from "../../../../src/modules/contas/register.service";
import type {
  ContaCriada,
  ContaRepository,
} from "../../../../src/modules/contas/conta.repository";
import type { RegisterData } from "../../../../src/modules/contas/register.schema";

class ContaRepositoryFalso implements ContaRepository {
  receivedData?: RegisterData;

  async create(data: RegisterData): Promise<ContaCriada> {
    this.receivedData = data;

    return {
      id: 1,
      nome: data.nome,
      email: data.email,
      papeis: data.roles.map((papel) => ({ papel })),
      medico: data.medico
        ? {
            id: 1,
            crm: data.medico.crm,
            telefones: data.medico.telefones.map((telefone) => ({ telefone })),
          }
        : null,
    };
  }
}

describe("RegisterService", () => {
  it("registra conta ADMIN e normaliza o email", async () => {
    const repository = new ContaRepositoryFalso();
    const service = new RegisterService(repository);

    const conta = await service.execute({
      nome: "Administradora",
      email: " ADMIN@EXAMPLE.COM ",
      roles: ["ADMIN"],
    });

    expect(conta.conta.papeis).toEqual([{ papel: "ADMIN" }]);
    expect(conta.conta.medico).toBeNull();
    expect(conta.activationToken).toHaveLength(64);
    expect(repository.receivedData?.email).toBe("admin@example.com");
  });

  it("registra conta MEDICO com perfil profissional e telefones", async () => {
    const repository = new ContaRepositoryFalso();
    const service = new RegisterService(repository);

    const conta = await service.execute({
      nome: "Dra. Ana",
      email: "ana@example.com",
      roles: ["ADMIN", "MEDICO"],
      medico: {
        crm: "123456-ba",
        telefones: ["71999999999"],
      },
    });

    expect(conta.conta.papeis).toEqual([{ papel: "ADMIN" }, { papel: "MEDICO" }]);
    expect(conta.conta.medico).toEqual({
      id: 1,
      crm: "123456-BA",
      telefones: [{ telefone: "71999999999" }],
    });
  });

  it("rejeita MEDICO sem perfil profissional", async () => {
    const service = new RegisterService(new ContaRepositoryFalso());

    await expect(
      service.execute({
        nome: "Dra. Sem CRM",
        email: "sem-crm@example.com",
        roles: ["MEDICO"],
      }),
    ).rejects.toThrow("O perfil medico e obrigatorio para contas com o papel MEDICO.");
  });
});
