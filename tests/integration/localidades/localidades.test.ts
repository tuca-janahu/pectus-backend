import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "../../../src/db/prisma";
import { PrismaLocalidadeRepository } from "../../../src/modules/localidades/localidade.repository";
import { LocalidadeService } from "../../../src/modules/localidades/localidade.service";
import { ensureLocalidadesFixture, FIXTURE_ESTADO_PA, FIXTURE_MUNICIPIO_BELEM } from "../../setup/localidades-fixture";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL deve estar configurada no ambiente de teste.");
}

const testPrisma = createPrismaClient(databaseUrl);
const localidadeRepository = new PrismaLocalidadeRepository(testPrisma);
const service = new LocalidadeService(localidadeRepository);

describe("Localidades", () => {
  beforeAll(async () => {
    await testPrisma.$connect();
    await ensureLocalidadesFixture(testPrisma);
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("lista estados incluindo o Pará", async () => {
    const estados = await service.listarEstados();
    expect(estados.some((e) => e.codigo === FIXTURE_ESTADO_PA.codigo)).toBe(true);
  });

  it("lista municípios de um estado, incluindo Belém marcado como RMB", async () => {
    const municipios = await service.listarMunicipios(FIXTURE_ESTADO_PA.codigo);
    const belem = municipios.find((m) => m.codigo === FIXTURE_MUNICIPIO_BELEM.codigo);
    expect(belem).toBeDefined();
    expect(belem?.pertenceRmBelem).toBe(true);
  });

  it("atualiza e persiste o flag pertenceRmBelem", async () => {
    await service.atualizarMunicipio(FIXTURE_MUNICIPIO_BELEM.codigo, { pertenceRmBelem: false });
    const municipio = await localidadeRepository.buscarMunicipioPorCodigo(FIXTURE_MUNICIPIO_BELEM.codigo);
    expect(municipio?.pertenceRmBelem).toBe(false);

    // Restaura o estado original, ja que estado/municipio nao sao limpos entre testes.
    await service.atualizarMunicipio(FIXTURE_MUNICIPIO_BELEM.codigo, { pertenceRmBelem: true });
  });

  it("rejeita atualizar um município inexistente", async () => {
    await expect(service.atualizarMunicipio(999999, { pertenceRmBelem: true })).rejects.toThrow(
      "Município não encontrado",
    );
  });
});
