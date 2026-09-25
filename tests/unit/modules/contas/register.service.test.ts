import { describe, expect, it } from "vitest";

import { RegisterService } from "../../../../src/modules/contas/register.service";
import type {
  AtualizarContaInput,
  ContaCriada,
  ContaRepository,
  ContaResumo,
} from "../../../../src/modules/contas/conta.repository";
import type { RegisterData } from "../../../../src/modules/contas/register.schema";
import type {
  ActivationEmailInput,
  Mailer,
  PasswordResetEmailInput,
} from "../../../../src/modules/email/mailer";
import type {
  ListarLogsFiltro,
  LogRepository,
  RegistrarLogInput,
} from "../../../../src/modules/logs/log.repository";

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

  async listar(): Promise<ContaResumo[]> {
    throw new Error("nao usado neste teste");
  }

  async buscarPorId(_id: number): Promise<ContaResumo | null> {
    throw new Error("nao usado neste teste");
  }

  async atualizar(_id: number, _input: AtualizarContaInput): Promise<ContaResumo> {
    throw new Error("nao usado neste teste");
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

class LogRepositoryFalso implements LogRepository {
  registrados: RegistrarLogInput[] = [];

  async criar(input: RegistrarLogInput) {
    this.registrados.push(input);
  }

  async listar(_filtro: ListarLogsFiltro) {
    throw new Error("não usado neste teste");
  }
}

describe("RegisterService", () => {
  it("registra conta ADMIN, normaliza o email e envia e-mail de ativação", async () => {
    const repository = new ContaRepositoryFalso();
    const mailer = new MailerFalso();
    const logRepository = new LogRepositoryFalso();
    const service = new RegisterService(repository, mailer, logRepository);

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
    expect(logRepository.registrados).toHaveLength(1);
    expect(logRepository.registrados[0]).toMatchObject({ modulo: "USUARIOS", tipo: "USUARIO_CRIADO" });
  });

  it("registra conta MEDICO com perfil profissional e telefones", async () => {
    const repository = new ContaRepositoryFalso();
    const service = new RegisterService(repository, new MailerFalso(), new LogRepositoryFalso());

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
    const service = new RegisterService(new ContaRepositoryFalso(), new MailerFalso(), new LogRepositoryFalso());

    await expect(
      service.execute({
        nome: "Dra. Sem CRM",
        email: "sem-crm@example.com",
        roles: ["MEDICO"],
      }),
    ).rejects.toThrow("O perfil medico e obrigatorio para contas com o papel MEDICO.");
  });

  it("não lanca erro quando o envio de e-mail de ativação falha", async () => {
    const repository = new ContaRepositoryFalso();
    const service = new RegisterService(repository, new MailerQueFalha(), new LogRepositoryFalso());

    const conta = await service.execute({
      nome: "Administradora",
      email: "admin@example.com",
      roles: ["ADMIN"],
    });

    expect(conta.conta.email).toBe("admin@example.com");
    expect(conta.activationToken).toHaveLength(64);
  });
});
