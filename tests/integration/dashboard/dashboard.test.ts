import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient } from "../../../src/db/prisma";
import { DashboardService } from "../../../src/modules/dashboard/dashboard.service";
import { AtendimentoService } from "../../../src/modules/atendimentos/atendimento.service";

const db = createPrismaClient(process.env.DATABASE_URL!);
const service = new DashboardService(db);
const atendimentoService = new AtendimentoService(db);

describe("Dashboard agregado (integração)", () => {
  beforeAll(async () => { await db.$connect(); });
  afterEach(async () => {
    await db.atendimento.deleteMany();
    await db.ficha.deleteMany();
    await db.paciente.deleteMany();
    await db.medico.deleteMany();
    await db.contaPapel.deleteMany();
    await db.conta.deleteMany();
    await db.municipio.deleteMany({ where: { codigo: { in: [9999991, 9999992, 9999993] } } });
    await db.estado.deleteMany({ where: { codigo: { in: [98, 99] } } });
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

  it("agrega o mapa e aplica estado e município a todos os indicadores", async () => {
    await db.estado.createMany({ data: [
      { codigo: 98, nome: "Outra UF", sigla: "OU" },
      { codigo: 99, nome: "UF teste", sigla: "TT" },
    ] });
    await db.municipio.createMany({ data: [
      { codigo: 9999991, nome: "Cidade A", estadoCodigo: 99 },
      { codigo: 9999992, nome: "Cidade B", estadoCodigo: 99 },
      { codigo: 9999993, nome: "Cidade C", estadoCodigo: 98 },
    ] });
    const conta = await db.conta.create({ data: {
      nome: "Médico mapa", email: "mapa@example.test", papeis: { create: { papel: "MEDICO" } },
      medico: { create: { crm: "CRM-MAPA" } },
    }, include: { medico: true } });
    const outraConta = await db.conta.create({ data: {
      nome: "Outro médico mapa", email: "outro-mapa@example.test", papeis: { create: { papel: "MEDICO" } },
      medico: { create: { crm: "CRM-OUTRO-MAPA" } },
    }, include: { medico: true } });
    const medicoId = conta.medico!.id;
    const pacientes = await Promise.all([9999991, 9999992, 9999993, null].map((municipioId, indice) =>
      db.paciente.create({ data: {
        nome: `Paciente mapa ${indice}`, dataNascimento: new Date("1990-01-01"),
        genero: indice % 2 ? "MASCULINO" : "FEMININO", municipioId,
        ficha: { create: { vocaliza: indice === 0 } },
      }, include: { ficha: true } }),
    ));
    await db.atendimento.createMany({ data: [
      ...pacientes.map((paciente, indice) => ({
        fichaId: paciente.ficha!.id, medicoId: indice === 2 ? outraConta.medico!.id : medicoId,
        dataHoraPrevista: new Date(`2030-03-${String(10 + indice).padStart(2, "0")}T14:00:00Z`),
        status: "CONCLUIDA" as const, procedimento: indice === 0 ? "Broncoscopia" : "Consulta",
      })),
      { fichaId: pacientes[0].ficha!.id, medicoId, dataHoraPrevista: new Date("2030-03-11T14:00:00Z"), status: "CONCLUIDA", procedimento: "Broncoscopia" },
      { fichaId: pacientes[1].ficha!.id, medicoId, dataHoraPrevista: new Date("2030-03-12T14:00:00Z"), status: "CANCELADA", procedimento: "Consulta" },
    ] });

    const filtro = { de: "2030-03-10", ate: "2030-03-15", granularidade: "dia" as const };
    const mapa = await service.mapa({ de: filtro.de, ate: filtro.ate, estadoCodigo: 99 });
    expect(mapa.totalPacientes).toBe(4);
    expect(mapa.semLocalidade).toBe(1);
    expect(mapa.estados.find((item) => item.codigo === 99)?.total).toBe(2);
    expect(mapa.estados.find((item) => item.codigo === 98)?.total).toBe(1);
    expect(mapa.municipios.map((item) => item.total)).toEqual([1, 1]);
    expect((await service.mapa({ de: filtro.de, ate: filtro.ate, medicoId })).totalPacientes).toBe(3);

    const uf = await service.resumo({ ...filtro, estadoCodigo: 99 });
    expect(uf.indicadores).toMatchObject({ atendimentos: 4, concluidos: 3, cancelados: 1, pacientesAtendidos: 2 });
    expect(uf.serieAtendimentos.reduce((total, item) => total + item.CONCLUIDA + item.CANCELADA, 0)).toBe(4);
    expect(uf.porProcedimento.find((item) => item.procedimento === "Broncoscopia")?.total).toBe(2);
    expect(uf.demografia.denominadorPacientes).toBe(2);
    expect(uf.clinica.registrosPositivos.find((item) => item.indicador === "vocaliza")?.total).toBe(1);
    const cidade = await service.resumo({ ...filtro, estadoCodigo: 99, municipioCodigo: 9999991 });
    expect(cidade.indicadores).toMatchObject({ atendimentos: 2, concluidos: 2, cancelados: 0, pacientesAtendidos: 1 });
    expect(cidade.porProcedimento.find((item) => item.procedimento === "Broncoscopia")?.total).toBe(2);
    expect(await atendimentoService.listar({ estadoCodigo: 99, municipioCodigo: 9999991 })).toHaveLength(2);
    expect(await service.localidadeValida(99, 9999993)).toBe(false);
    expect(await service.localidadeValida(99, 9999991)).toBe(true);
  });
});
