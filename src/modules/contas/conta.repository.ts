import type { Papel, PrismaClient } from "../../generated/prisma/client";

import type { RegisterData } from "./register.schema";
import type { AtualizarContaInput } from "./update-conta.schema";

export interface ContaCriada {
  id: number;
  nome: string;
  email: string;
  papeis: Array<{ papel: Papel }>;
  medico: {
    id: number;
    crm: string;
    telefones: Array<{ telefone: string }>;
  } | null;
}

export interface ContaResumo {
  id: number;
  nome: string;
  email: string;
  papeis: Array<{ papel: Papel }>;
  medico: { id: number; crm: string } | null;
  inativadoEm: Date | null;
  ativada: boolean;
  criadoEm: Date;
}

export interface ContaRepository {
  create(
    data: RegisterData,
    activation: { tokenHash: string; expiraEm: Date },
  ): Promise<ContaCriada>;
  listar(): Promise<ContaResumo[]>;
  buscarPorId(id: number): Promise<ContaResumo | null>;
  atualizar(id: number, input: AtualizarContaInput): Promise<ContaResumo>;
}

type ContaComRelacoes = {
  id: number;
  nome: string;
  email: string;
  inativadoEm: Date | null;
  criadoEm: Date;
  papeis: Array<{ papel: Papel }>;
  medico: { id: number; crm: string } | null;
  identidades: Array<{ id: number }>;
};

export class PrismaContaRepository implements ContaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    { nome, email, roles, medico }: RegisterData,
    activation: { tokenHash: string; expiraEm: Date },
  ) {
    return this.prisma.conta.create({
      data: {
        nome,
        email,
        papeis: {
          create: roles.map((papel) => ({ papel })),
        },
        medico: medico
          ? {
              create: {
                crm: medico.crm,
                telefones: {
                  create: medico.telefones.map((telefone) => ({ telefone })),
                },
              },
            }
          : undefined,
        tokensAtivacao: {
          create: activation,
        },
      },
      include: {
        papeis: true,
        medico: {
          include: {
            telefones: true,
          },
        },
      },
    });
  }

  async listar(): Promise<ContaResumo[]> {
    const contas = await this.prisma.conta.findMany({
      include: {
        papeis: true,
        medico: { select: { id: true, crm: true } },
        identidades: { where: { provedor: "LOCAL" }, select: { id: true } },
      },
      orderBy: { criadoEm: "desc" },
    });
    return contas.map((conta) => this.paraResumo(conta));
  }

  async buscarPorId(id: number): Promise<ContaResumo | null> {
    const conta = await this.prisma.conta.findUnique({
      where: { id },
      include: {
        papeis: true,
        medico: { select: { id: true, crm: true } },
        identidades: { where: { provedor: "LOCAL" }, select: { id: true } },
      },
    });
    return conta ? this.paraResumo(conta) : null;
  }

  async atualizar(id: number, input: AtualizarContaInput): Promise<ContaResumo> {
    const contaAtual = await this.prisma.conta.findUnique({
      where: { id },
      include: { papeis: true, medico: true },
    });
    if (!contaAtual) {
      throw new Error("Conta nao encontrada");
    }

    await this.prisma.$transaction(async (tx) => {
      if (input.nome !== undefined) {
        await tx.conta.update({ where: { id }, data: { nome: input.nome } });
      }

      if (input.ativo !== undefined) {
        await tx.conta.update({
          where: { id },
          data: { inativadoEm: input.ativo ? null : new Date() },
        });
      }

      if (input.roles) {
        const papeisAtuais = contaAtual.papeis.map((p) => p.papel);
        const paraAdicionar = input.roles.filter((papel) => !papeisAtuais.includes(papel));
        const paraRemover = papeisAtuais.filter((papel) => !input.roles?.includes(papel));

        if (paraAdicionar.length > 0) {
          await tx.contaPapel.createMany({
            data: paraAdicionar.map((papel) => ({ contaId: id, papel })),
            skipDuplicates: true,
          });
        }
        if (paraRemover.length > 0) {
          await tx.contaPapel.deleteMany({ where: { contaId: id, papel: { in: paraRemover } } });
        }

        if (input.roles.includes("MEDICO") && !contaAtual.medico) {
          if (!input.crm) {
            throw new Error("CRM e obrigatorio para adicionar o papel MEDICO");
          }
          await tx.medico.create({ data: { contaId: id, crm: input.crm } });
        }
      }

      if (input.crm !== undefined && contaAtual.medico) {
        await tx.medico.update({ where: { contaId: id }, data: { crm: input.crm } });
      }
    });

    const atualizado = await this.buscarPorId(id);
    if (!atualizado) {
      throw new Error("Conta nao encontrada");
    }
    return atualizado;
  }

  private paraResumo(conta: ContaComRelacoes): ContaResumo {
    return {
      id: conta.id,
      nome: conta.nome,
      email: conta.email,
      papeis: conta.papeis.map(({ papel }) => ({ papel })),
      medico: conta.medico,
      inativadoEm: conta.inativadoEm,
      ativada: conta.identidades.length > 0,
      criadoEm: conta.criadoEm,
    };
  }
}
