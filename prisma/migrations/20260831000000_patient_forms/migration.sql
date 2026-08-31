-- CreateEnum
CREATE TYPE "StatusFicha" AS ENUM ('AGENDADA', 'EM_PREENCHIMENTO', 'CONCLUIDA', 'CANCELADA');

-- CreateTable
CREATE TABLE "medicos" (
    "id" SERIAL NOT NULL,
    "conta_id" INTEGER NOT NULL,
    "crm" VARCHAR(50) NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,
    "inativado_em" TIMESTAMPTZ(6),
    CONSTRAINT "medicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paises" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    CONSTRAINT "paises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estados" (
    "id" SERIAL NOT NULL,
    "pais_id" INTEGER NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "sigla" VARCHAR(10) NOT NULL,
    CONSTRAINT "estados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pacientes" (
    "id" SERIAL NOT NULL,
    "estado_id" INTEGER,
    "cpf" VARCHAR(11),
    "nome" VARCHAR(255) NOT NULL,
    "municipio" VARCHAR(120) NOT NULL,
    "data_nascimento" DATE NOT NULL,
    "genero" VARCHAR(50) NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,
    "inativado_em" TIMESTAMPTZ(6),
    CONSTRAINT "pacientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telefones" (
    "id" SERIAL NOT NULL,
    "paciente_id" INTEGER,
    "medico_id" INTEGER,
    "telefone" VARCHAR(30) NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "telefones_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "telefones_dono_xor_check" CHECK (
      ("paciente_id" IS NOT NULL AND "medico_id" IS NULL)
      OR ("paciente_id" IS NULL AND "medico_id" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "fichas_epicriticas" (
    "id" SERIAL NOT NULL,
    "paciente_id" INTEGER NOT NULL,
    "medico_id" INTEGER NOT NULL,
    "data_hora_prevista" TIMESTAMPTZ(6) NOT NULL,
    "status" "StatusFicha" NOT NULL DEFAULT 'AGENDADA',
    "observacoes" TEXT,
    "mecanismo_lesao" TEXT,
    "data_injuria_traqueal" DATE,
    "vocaliza" BOOLEAN NOT NULL DEFAULT false,
    "traqueostomizado" BOOLEAN NOT NULL DEFAULT false,
    "possui_comorbidades" BOOLEAN NOT NULL DEFAULT false,
    "comorbidades_descricao" TEXT,
    "possui_sequelas" BOOLEAN NOT NULL DEFAULT false,
    "sequelas_descricao" TEXT,
    "usa_medicamentos" BOOLEAN NOT NULL DEFAULT false,
    "medicamentos_descricao" TEXT,
    "possui_laringoscopia" BOOLEAN NOT NULL DEFAULT false,
    "achado_laringoscopia" TEXT,
    "particularidades" TEXT,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,
    "inativado_em" TIMESTAMPTZ(6),
    CONSTRAINT "fichas_epicriticas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "medicos_conta_id_key" ON "medicos"("conta_id");
CREATE UNIQUE INDEX "medicos_crm_key" ON "medicos"("crm");
CREATE UNIQUE INDEX "paises_nome_key" ON "paises"("nome");
CREATE UNIQUE INDEX "estados_pais_id_sigla_key" ON "estados"("pais_id", "sigla");
CREATE UNIQUE INDEX "pacientes_cpf_key" ON "pacientes"("cpf");
CREATE INDEX "pacientes_estado_id_idx" ON "pacientes"("estado_id");
CREATE INDEX "pacientes_nome_idx" ON "pacientes"("nome");
CREATE INDEX "telefones_paciente_id_idx" ON "telefones"("paciente_id");
CREATE INDEX "telefones_medico_id_idx" ON "telefones"("medico_id");
CREATE INDEX "fichas_epicriticas_paciente_id_idx" ON "fichas_epicriticas"("paciente_id");
CREATE INDEX "fichas_epicriticas_medico_id_idx" ON "fichas_epicriticas"("medico_id");
CREATE INDEX "fichas_epicriticas_status_idx" ON "fichas_epicriticas"("status");
CREATE INDEX "fichas_epicriticas_data_hora_prevista_idx" ON "fichas_epicriticas"("data_hora_prevista");

-- AddForeignKey
ALTER TABLE "medicos" ADD CONSTRAINT "medicos_conta_id_fkey"
  FOREIGN KEY ("conta_id") REFERENCES "contas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "estados" ADD CONSTRAINT "estados_pais_id_fkey"
  FOREIGN KEY ("pais_id") REFERENCES "paises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pacientes" ADD CONSTRAINT "pacientes_estado_id_fkey"
  FOREIGN KEY ("estado_id") REFERENCES "estados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "telefones" ADD CONSTRAINT "telefones_paciente_id_fkey"
  FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "telefones" ADD CONSTRAINT "telefones_medico_id_fkey"
  FOREIGN KEY ("medico_id") REFERENCES "medicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fichas_epicriticas" ADD CONSTRAINT "fichas_epicriticas_paciente_id_fkey"
  FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fichas_epicriticas" ADD CONSTRAINT "fichas_epicriticas_medico_id_fkey"
  FOREIGN KEY ("medico_id") REFERENCES "medicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
