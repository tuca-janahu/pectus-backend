import type { PrismaClient } from "../../src/generated/prisma/client";

export const FIXTURE_ESTADO_PA = { codigo: 15, sigla: "PA", nome: "Pará" };
export const FIXTURE_ESTADO_SP = { codigo: 35, sigla: "SP", nome: "São Paulo" };
export const FIXTURE_MUNICIPIO_BELEM = { codigo: 1501402, nome: "Belém", estadoCodigo: 15, pertenceRmBelem: true };
export const FIXTURE_MUNICIPIO_SANTAREM = { codigo: 1506807, nome: "Santarém", estadoCodigo: 15, pertenceRmBelem: false };

// Estado/municipio sao dado de referencia seedado, nao fixture por teste — diferente de
// toda tabela que os testes de integracao limpam no afterEach, essas linhas persistem
// durante toda a suite (upsert idempotente, nunca deletadas).
export async function ensureLocalidadesFixture(prisma: PrismaClient) {
  for (const estado of [FIXTURE_ESTADO_PA, FIXTURE_ESTADO_SP]) {
    await prisma.estado.upsert({ where: { codigo: estado.codigo }, create: estado, update: {} });
  }
  for (const municipio of [FIXTURE_MUNICIPIO_BELEM, FIXTURE_MUNICIPIO_SANTAREM]) {
    await prisma.municipio.upsert({ where: { codigo: municipio.codigo }, create: municipio, update: {} });
  }
}
