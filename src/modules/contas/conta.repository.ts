import type { Papel, PrismaClient } from "../../generated/prisma/client";

import type { RegisterData } from "./register.schema";

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

export interface ContaRepository {
  create(data: RegisterData): Promise<ContaCriada>;
}

export class PrismaContaRepository implements ContaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create({ nome, email, roles, medico }: RegisterData) {
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
}
