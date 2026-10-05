import { describe, expect, it } from "vitest";
import { z } from "zod";

import { Prisma } from "../../../src/generated/prisma/client";
import { mensagemDeErro } from "../../../src/shared/error-message";

function erroPrisma(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError("mensagem interna do Prisma, nunca deve vazar", {
    code,
    clientVersion: "test",
    meta,
  });
}

describe("mensagemDeErro", () => {
  it("mapeia violação de unicidade (P2002) para uma mensagem segura, citando o campo (meta.target)", () => {
    const erro = erroPrisma("P2002", { target: ["cpf"] });
    expect(mensagemDeErro(erro)).toBe("Já existe um registro com esse CPF.");
  });

  it("mapeia violação de unicidade (P2002) no formato real do adapter-pg (constraint.index, sem target)", () => {
    // Formato de meta efetivamente produzido neste projeto (adapter-pg), reproduzido
    // a partir do erro real de CPF duplicado reportado em produção.
    const erro = erroPrisma("P2002", {
      driverAdapterError: {
        name: "DriverAdapterError",
        cause: {
          originalCode: "23505",
          originalMessage: 'duplicate key value violates unique constraint "pacientes_cpf_key"',
          kind: "UniqueConstraintViolation",
          constraint: { index: "pacientes_cpf_key" },
          table: "pacientes",
        },
      },
      modelName: "Paciente",
    });
    expect(mensagemDeErro(erro)).toBe("Já existe um registro com esse CPF.");
  });

  it("mapeia violação de unicidade sem alvo conhecido para uma mensagem genérica", () => {
    const erro = erroPrisma("P2002", {});
    expect(mensagemDeErro(erro)).toBe("Já existe um registro com esses dados.");
  });

  it("mapeia registro não encontrado (P2025)", () => {
    expect(mensagemDeErro(erroPrisma("P2025"))).toBe("Registro não encontrado.");
  });

  it("mapeia violação de chave estrangeira (P2003)", () => {
    expect(mensagemDeErro(erroPrisma("P2003"))).toBe("Não é possível concluir a operação: há dados relacionados a esse registro.");
  });

  it("nunca vaza a mensagem interna de um erro do Prisma não mapeado", () => {
    const mensagem = mensagemDeErro(erroPrisma("P9999"));
    expect(mensagem).toBe("Erro interno. Tente novamente.");
    expect(mensagem).not.toContain("Prisma");
  });

  it("extrai a primeira mensagem de um ZodError", () => {
    const schema = z.object({ nome: z.string().min(1, "Nome é obrigatório") });
    const resultado = schema.safeParse({ nome: "" });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(mensagemDeErro(resultado.error)).toBe("Nome é obrigatório");
    }
  });

  it("repassa mensagens de erros lançados deliberadamente pelos serviços", () => {
    expect(mensagemDeErro(new Error("Paciente não encontrado"))).toBe("Paciente não encontrado");
  });

  it("não vaza mensagens de subclasses de Error não reconhecidas", () => {
    class ErroDeLibExterna extends Error {}
    const mensagem = mensagemDeErro(new ErroDeLibExterna("detalhe interno sensível"));
    expect(mensagem).toBe("Erro interno. Tente novamente.");
  });

  it("usa o fallback customizado quando informado", () => {
    class ErroDeLibExterna extends Error {}
    expect(mensagemDeErro(new ErroDeLibExterna("x"), "Não foi possível completar a ação.")).toBe(
      "Não foi possível completar a ação.",
    );
  });

  it("nunca vaza um valor não-Error lançado diretamente", () => {
    expect(mensagemDeErro("string lançada diretamente")).toBe("Erro interno. Tente novamente.");
  });
});
