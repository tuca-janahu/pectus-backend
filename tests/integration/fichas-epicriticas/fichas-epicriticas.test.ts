import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "../../../src/db/prisma";
import { PrismaFichaEpicriticaRepository } from "../../../src/modules/fichas-epicriticas/ficha-epicritica.repository";
import { FichaEpicriticaService } from "../../../src/modules/fichas-epicriticas/ficha-epicritica.service";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL deve estar configurada no ambiente de teste.");

const prisma = createPrismaClient(databaseUrl);
const service = new FichaEpicriticaService(new PrismaFichaEpicriticaRepository(prisma));
let pacienteId: number;
let medicoId: number;
let contaId: number;

describe("Fichas epicríticas", () => {
  beforeAll(() => prisma.$connect());

  beforeEach(async () => {
    const sufixo = `${Date.now()}-${Math.random()}`;
    const conta = await prisma.conta.create({
      data: {
        nome: "Médica Teste",
        email: `medica-${sufixo}@example.com`,
        papeis: { create: { papel: "MEDICO" } },
        medico: { create: { crm: `CRM-${sufixo}` } },
      },
      include: { medico: true },
    });
    const paciente = await prisma.paciente.create({
      data: {
        nome: "Paciente Teste",
        dataNascimento: new Date("1990-01-01T00:00:00.000Z"),
        genero: "feminino",
      },
    });
    contaId = conta.id;
    medicoId = conta.medico!.id;
    pacienteId = paciente.id;
  });

  afterEach(async () => {
    await prisma.fichaEpicritica.deleteMany({ where: { pacienteId } });
    await prisma.paciente.delete({ where: { id: pacienteId } });
    await prisma.contaPapel.deleteMany({ where: { contaId } });
    await prisma.medico.delete({ where: { id: medicoId } });
    await prisma.conta.delete({ where: { id: contaId } });
  });

  afterAll(() => prisma.$disconnect());

  it("usa os defaults na primeira ficha do paciente", async () => {
    const ficha = await service.criar({ pacienteId, medicoId, iniciarAgora: true }) as {
      status: string;
      vocaliza: boolean;
      possuiLaringoscopia: boolean;
    };

    expect(ficha.status).toBe("EM_PREENCHIMENTO");
    expect(ficha.vocaliza).toBe(false);
    expect(ficha.possuiLaringoscopia).toBe(false);
  });

  it("herda os campos clínicos da última ficha concluída somente ao iniciar", async () => {
    const primeira = await service.criar({ pacienteId, medicoId, iniciarAgora: true }) as { id: number };
    await service.atualizar(primeira.id, {
      vocaliza: true,
      possuiComorbidades: true,
      comorbidadesDescricao: "Hipertensão",
      possuiLaringoscopia: true,
      achadoLaringoscopia: "Sem alterações",
      observacoes: "Observação exclusiva da primeira consulta",
    });
    await service.concluir(primeira.id);

    const agendada = await service.criar({
      pacienteId,
      medicoId,
      dataHoraPrevista: "2030-01-10T12:00:00.000Z",
    }) as { id: number; possuiLaringoscopia: boolean };
    expect(agendada.possuiLaringoscopia).toBe(false);

    const iniciada = await service.iniciar(agendada.id) as {
      status: string;
      vocaliza: boolean;
      possuiComorbidades: boolean;
      comorbidadesDescricao: string | null;
      possuiLaringoscopia: boolean;
      achadoLaringoscopia: string | null;
      observacoes: string | null;
    };
    expect(iniciada).toMatchObject({
      status: "EM_PREENCHIMENTO",
      vocaliza: true,
      possuiComorbidades: true,
      comorbidadesDescricao: "Hipertensão",
      possuiLaringoscopia: true,
      achadoLaringoscopia: "Sem alterações",
      observacoes: null,
    });
  });

  it("permite mudar uma opção herdada e limpa sua descrição associada", async () => {
    const primeira = await service.criar({ pacienteId, medicoId, iniciarAgora: true }) as { id: number };
    await service.atualizar(primeira.id, {
      possuiComorbidades: true,
      comorbidadesDescricao: "Hipertensão",
    });
    await service.concluir(primeira.id);

    const segunda = await service.criar({ pacienteId, medicoId, iniciarAgora: true }) as { id: number };
    const atualizada = await service.atualizar(segunda.id, { possuiComorbidades: false }) as {
      possuiComorbidades: boolean;
      comorbidadesDescricao: string | null;
    };

    expect(atualizada.possuiComorbidades).toBe(false);
    expect(atualizada.comorbidadesDescricao).toBeNull();
  });

  it("não permite editar uma ficha concluída", async () => {
    const ficha = await service.criar({ pacienteId, medicoId, iniciarAgora: true }) as { id: number };
    await service.concluir(ficha.id);

    await expect(service.atualizar(ficha.id, { vocaliza: true })).rejects.toThrow(
      "Apenas fichas em preenchimento podem ser editadas",
    );
  });
});
