import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient } from "../../../src/db/prisma";
import { DashboardService } from "../../../src/modules/dashboard/dashboard.service";

const db = createPrismaClient(process.env.DATABASE_URL!);
const service = new DashboardService(db);

describe("Dashboard agregado (integração)", () => {
  beforeAll(async () => { await db.$connect(); });
  afterEach(async () => {
    await db.atendimento.deleteMany();
    await db.ficha.deleteMany();
    await db.paciente.deleteMany();
    await db.medico.deleteMany();
    await db.contaPapel.deleteMany();
    await db.conta.deleteMany();
    await db.municipio.deleteMany({ where: { codigo: { in: [9999991, 9999992] } } });
    await db.estado.deleteMany({ where: { codigo: 99 } });
  });
  afterAll(async () => { await db.$disconnect(); });

  it("conta pacientes distintos, usa a ficha atual e separa municípios da RMB", async () => {
    await db.estado.create({ data: { codigo: 99, nome: "Teste", sigla: "TT" } });
    await db.municipio.createMany({ data: [
      { codigo: 9999991, nome: "Dentro", estadoCodigo: 99, pertenceRmBelem: true },
      { codigo: 9999992, nome: "Fora", estadoCodigo: 99, pertenceRmBelem: false },
    ] });
    const conta = await db.conta.create({ data: {
      nome: "Médico dashboard", email: "dashboard@example.test",
      papeis: { create: { papel: "MEDICO" } }, medico: { create: { crm: "CRM-DASHBOARD" } },
    }, include: { medico: true } });
    const primeiro = await db.paciente.create({ data: {
      nome: "Primeira", dataNascimento: new Date("1990-01-01"), genero: "FEMININO", municipioId: 9999991,
      ficha: { create: { vocaliza: true, traqueostomizado: true } },
    }, include: { ficha: true } });
    const segundo = await db.paciente.create({ data: {
      nome: "Segundo", dataNascimento: new Date("2000-01-01"), genero: "MASCULINO", municipioId: 9999992,
      ficha: { create: {} },
    }, include: { ficha: true } });
    await db.atendimento.createMany({ data: [
      { fichaId: primeiro.ficha!.id, medicoId: conta.medico!.id, dataHoraPrevista: new Date("2030-01-10T14:00:00Z"), status: "CONCLUIDA", procedimento: "Broncoscopia" },
      { fichaId: primeiro.ficha!.id, medicoId: conta.medico!.id, dataHoraPrevista: new Date("2030-01-11T14:00:00Z"), status: "CONCLUIDA", procedimento: "Broncoscopia" },
      { fichaId: segundo.ficha!.id, medicoId: conta.medico!.id, dataHoraPrevista: new Date("2030-01-11T15:00:00Z"), status: "CONCLUIDA", procedimento: "Exame de rotina" },
      { fichaId: segundo.ficha!.id, medicoId: conta.medico!.id, dataHoraPrevista: new Date("2030-01-12T15:00:00Z"), status: "CANCELADA", procedimento: "Exame de rotina" },
    ] });

    const resumo = await service.resumo({ de: "2030-01-10", ate: "2030-01-12", granularidade: "dia" });
    expect(resumo.indicadores).toMatchObject({ atendimentos: 4, concluidos: 3, cancelados: 1, pacientesAtendidos: 2 });
    expect(resumo.serieAtendimentos).toHaveLength(3);
    expect(resumo.serieAtendimentos[1].CONCLUIDA).toBe(2);
    expect(resumo.demografia.porGenero.map((item) => item.total)).toEqual([1, 1]);
    expect(resumo.clinica.registrosPositivos.find((item) => item.indicador === "vocaliza")?.total).toBe(1);
    expect(resumo.regiao.porGrupo.map((item) => item.total)).toEqual([1, 1, 0]);

    const filtrado = await service.resumo({ de: "2030-01-10", ate: "2030-01-10", medicoId: conta.medico!.id, granularidade: "dia" });
    expect(filtrado.indicadores.pacientesAtendidos).toBe(1);
    expect(filtrado.indicadores.atendimentos).toBe(1);
  });
});
