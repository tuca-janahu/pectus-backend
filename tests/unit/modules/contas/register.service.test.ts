import { describe, expect, it } from "vitest";

import { RegisterService } from "../../../../src/modules/contas/register.service";
import type {
  ContaCriada,
  ContaRepository,
} from "../../../../src/modules/contas/conta.repository";
import type { RegisterData } from "../../../../src/modules/contas/register.schema";
import type {
  ActivationEmailInput,
  Mailer,
  PasswordResetEmailInput,
} from "../../../../src/modules/email/mailer";

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

class MailerFalso implements Mailer {
  activationEmailsSent: ActivationEmailInput[] = [];

  async sendActivationEmail(input: ActivationEmailInput) {
    this.activationEmailsSent.push(input);
  }

  async sendPasswordResetEmail(_input: PasswordResetEmailInput) {}
}

class MailerQueFalha implements Mailer {
  async sendActivationEmail(): Promise<void> {
    throw new Error("Resend indisponivel");
  }

  async sendPasswordResetEmail(): Promise<void> {
    throw new Error("Resend indisponivel");
  }
}

describe("RegisterService", () => {
  it("registra conta ADMIN, normaliza o email e envia e-mail de ativacao", async () => {
    const repository = new ContaRepositoryFalso();
    const mailer = new MailerFalso();
    const service = new RegisterService(repository, mailer);

    const conta = await service.execute({
      nome: "Administradora",
      email: " ADMIN@EXAMPLE.COM ",
      roles: ["ADMIN"],
    });

    expect(conta.conta.papeis).toEqual([{ papel: "ADMIN" }]);
    expect(conta.conta.medico).toBeNull();
    expect(conta.activationToken).toHaveLength(64);
    expect(repository.receivedData?.email).toBe("admin@example.com");
    expect(mailer.activationEmailsSent).toHaveLength(1);
    expect(mailer.activationEmailsSent[0].to).toBe("admin@example.com");
  });

  it("registra conta MEDICO com perfil profissional e telefones", async () => {
    const repository = new ContaRepositoryFalso();
    const service = new RegisterService(repository, new MailerFalso());

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
    const service = new RegisterService(new ContaRepositoryFalso(), new MailerFalso());

    await expect(
      service.execute({
        nome: "Dra. Sem CRM",
        email: "sem-crm@example.com",
        roles: ["MEDICO"],
      }),
    ).rejects.toThrow("O perfil medico e obrigatorio para contas com o papel MEDICO.");
  });

  it("nao lanca erro quando o envio de e-mail de ativacao falha", async () => {
    const repository = new ContaRepositoryFalso();
    const service = new RegisterService(repository, new MailerQueFalha());

    const conta = await service.execute({
      nome: "Administradora",
      email: "admin@example.com",
      roles: ["ADMIN"],
    });

    expect(conta.conta.email).toBe("admin@example.com");
    expect(conta.activationToken).toHaveLength(64);
  });
});
