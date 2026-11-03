import type { PrismaClient } from "../generated/prisma/client";

type Evento = Record<string, unknown>;

function eventoComAutor(item: unknown): item is Evento {
  return typeof item === "object" && item !== null && !Array.isArray(item);
}

export async function emailsDosAutores(prisma: PrismaClient, historicos: unknown[]): Promise<Map<number, string>> {
  const ids = new Set<number>();
  for (const historico of historicos) {
    if (!Array.isArray(historico)) continue;
    for (const item of historico) {
      if (eventoComAutor(item) && typeof item.autorContaId === "number" && Number.isInteger(item.autorContaId)) {
        ids.add(item.autorContaId);
      }
    }
  }
  if (ids.size === 0) return new Map();
  const contas = await prisma.conta.findMany({ where: { id: { in: [...ids] } }, select: { id: true, email: true } });
  return new Map(contas.map(({ id, email }) => [id, email]));
}

export function historicoComEmails(historico: unknown, emails: Map<number, string>) {
  if (!Array.isArray(historico)) return historico;
  return historico.map((item) => {
    if (!eventoComAutor(item)) return item;
    const autorEmail = typeof item.autorContaId === "number" ? emails.get(item.autorContaId) ?? null : null;
    return { ...item, autorEmail };
  });
}
