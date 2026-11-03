import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../../src/generated/prisma/client";
import { emailsDosAutores, historicoComEmails } from "../../../src/shared/historico-autores";

describe("autores de históricos clínico e cadastral", () => {
  it("resolve IDs existentes em uma consulta e preserva os eventos originais", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 6, email: "medica@pectus.test" }]);
    const prisma = { conta: { findMany } } as unknown as PrismaClient;
    const historico = [
      { tipo: "INICIADO", autorContaId: 6, campos: { status: { antes: "AGENDADA", depois: "EM_PREENCHIMENTO" } } },
      { tipo: "CONCLUIDO", autorContaId: 6, campos: {} },
      { tipo: "CORRIGIDO", autorContaId: 9, campos: {} },
    ];

    const emails = await emailsDosAutores(prisma, [historico]);
    expect(findMany).toHaveBeenCalledOnce();
    expect(findMany).toHaveBeenCalledWith({ where: { id: { in: [6, 9] } }, select: { id: true, email: true } });
    expect(historicoComEmails(historico, emails)).toEqual([
      { ...historico[0], autorEmail: "medica@pectus.test" },
      { ...historico[1], autorEmail: "medica@pectus.test" },
      { ...historico[2], autorEmail: null },
    ]);
    expect(historico[0]).not.toHaveProperty("autorEmail");
  });

  it("não consulta contas quando não há autor identificado", async () => {
    const findMany = vi.fn();
    const prisma = { conta: { findMany } } as unknown as PrismaClient;
    const historico = [{ autorContaId: null, campos: {} }];
    const emails = await emailsDosAutores(prisma, [historico, null]);
    expect(findMany).not.toHaveBeenCalled();
    expect(historicoComEmails(historico, emails)).toEqual([{ ...historico[0], autorEmail: null }]);
  });
});
