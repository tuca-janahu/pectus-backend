import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import type { DashboardFiltro } from "./dashboard.schema";

type Contagem = { chave: string; total: bigint };
type Serie = { periodo: Date; status: string; total: bigint };
type Clinica = {
  total: bigint; emTratamento: bigint; foraTratamento: bigint;
  alta: bigint; abandono: bigint; obito: bigint;
  vocaliza: bigint; traqueostomizado: bigint; comorbidades: bigint;
  sequelas: bigint; medicamentos: bigint; laringoscopia: bigint;
};
type Regiao = { codigo: number | null; municipio: string | null; grupo: string; total: bigint };

export class DashboardRepository {
  constructor(private readonly db: PrismaClient) {}

  async consultar(filtro: DashboardFiltro) {
    const { de, ate, medicoId, granularidade } = filtro;
    const periodo = Prisma.sql`
      a.data_hora_prevista >= (${de}::date::timestamp AT TIME ZONE 'America/Sao_Paulo')
      AND a.data_hora_prevista < ((${ate}::date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
      AND (${medicoId ?? null}::integer IS NULL OR a.medico_id = ${medicoId ?? null}::integer)`;
    const coorte = Prisma.sql`
      SELECT DISTINCT f.paciente_id
      FROM atendimentos a JOIN fichas f ON f.id = a.ficha_id
      WHERE ${periodo} AND a.status = 'CONCLUIDA'`;
    const agrupamento = granularidade === "dia" ? "day" : granularidade === "semana" ? "week" : "month";

    const [status, serie, procedimentos, idades, generos, clinica, regiao] = await Promise.all([
      this.db.$queryRaw<Contagem[]>`
        SELECT a.status::text AS chave, COUNT(*) AS total FROM atendimentos a
        WHERE ${periodo} GROUP BY a.status`,
      this.db.$queryRaw<Serie[]>`
        SELECT date_trunc(${agrupamento}, a.data_hora_prevista AT TIME ZONE 'America/Sao_Paulo') AS periodo,
          a.status::text AS status, COUNT(*) AS total
        FROM atendimentos a WHERE ${periodo} GROUP BY 1, 2 ORDER BY 1`,
      this.db.$queryRaw<Contagem[]>`
        SELECT COALESCE(NULLIF(BTRIM(a.procedimento), ''), 'Não informado') AS chave, COUNT(*) AS total
        FROM atendimentos a WHERE ${periodo} AND a.status <> 'CANCELADA'
        GROUP BY 1 ORDER BY total DESC, chave`,
      this.db.$queryRaw<Contagem[]>`
        SELECT CASE
          WHEN EXTRACT(YEAR FROM age(${ate}::date, p.data_nascimento)) < 18 THEN '0–17'
          WHEN EXTRACT(YEAR FROM age(${ate}::date, p.data_nascimento)) < 30 THEN '18–29'
          WHEN EXTRACT(YEAR FROM age(${ate}::date, p.data_nascimento)) < 45 THEN '30–44'
          WHEN EXTRACT(YEAR FROM age(${ate}::date, p.data_nascimento)) < 60 THEN '45–59'
          ELSE '60+' END AS chave, COUNT(*) AS total
        FROM pacientes p WHERE p.id IN (${coorte}) GROUP BY 1`,
      this.db.$queryRaw<Contagem[]>`
        SELECT p.genero::text AS chave, COUNT(*) AS total
        FROM pacientes p WHERE p.id IN (${coorte}) GROUP BY p.genero`,
      this.db.$queryRaw<Clinica[]>`
        SELECT COUNT(*) AS total,
          COUNT(*) FILTER (WHERE f.situacao = 'EM_TRATAMENTO') AS "emTratamento",
          COUNT(*) FILTER (WHERE f.situacao = 'FORA_DE_TRATAMENTO') AS "foraTratamento",
          COUNT(*) FILTER (WHERE f.motivo_encerramento = 'ALTA') AS alta,
          COUNT(*) FILTER (WHERE f.motivo_encerramento = 'ABANDONO') AS abandono,
          COUNT(*) FILTER (WHERE f.motivo_encerramento = 'OBITO') AS obito,
          COUNT(*) FILTER (WHERE f.vocaliza) AS vocaliza,
          COUNT(*) FILTER (WHERE f.traqueostomizado) AS traqueostomizado,
          COUNT(*) FILTER (WHERE f.possui_comorbidades) AS comorbidades,
          COUNT(*) FILTER (WHERE f.possui_sequelas) AS sequelas,
          COUNT(*) FILTER (WHERE f.usa_medicamentos) AS medicamentos,
          COUNT(*) FILTER (WHERE f.possui_laringoscopia) AS laringoscopia
        FROM fichas f WHERE f.paciente_id IN (${coorte})`,
      this.db.$queryRaw<Regiao[]>`
        SELECT m.codigo, m.nome AS municipio,
          CASE WHEN m.codigo IS NULL THEN 'NAO_INFORMADO'
            WHEN m.pertence_rm_belem THEN 'RM_BELEM' ELSE 'OUTRAS_LOCALIDADES' END AS grupo,
          COUNT(*) AS total
        FROM pacientes p LEFT JOIN municipios m ON m.codigo = p.municipio_id
        WHERE p.id IN (${coorte}) GROUP BY m.codigo, m.nome, grupo ORDER BY total DESC, m.nome`,
    ]);
    return { status, serie, procedimentos, idades, generos, clinica: clinica[0], regiao };
  }
}
