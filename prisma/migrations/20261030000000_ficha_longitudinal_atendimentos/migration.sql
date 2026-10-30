-- Os registros clínicos anteriores são apenas dados de teste. Aplicar esta
-- migration somente no ambiente descartável identificado e autorizado.
BEGIN;

DROP TABLE "fichas_epicriticas";
DROP TYPE "StatusFicha";

CREATE TYPE "StatusAtendimento" AS ENUM ('AGENDADA', 'EM_PREENCHIMENTO', 'CONCLUIDA', 'CANCELADA');
CREATE TYPE "SituacaoFicha" AS ENUM ('EM_TRATAMENTO', 'FORA_DE_TRATAMENTO');
CREATE TYPE "MotivoEncerramento" AS ENUM ('ALTA', 'ABANDONO', 'OBITO');

ALTER TABLE "pacientes" ADD COLUMN "historico_cadastral" JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE "fichas" (
  "id" SERIAL PRIMARY KEY,
  "paciente_id" INTEGER NOT NULL UNIQUE REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "situacao" "SituacaoFicha" NOT NULL DEFAULT 'EM_TRATAMENTO',
  "motivo_encerramento" "MotivoEncerramento",
  "data_encerramento" DATE,
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
  "versao" INTEGER NOT NULL DEFAULT 0,
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "fichas_encerramento_check" CHECK (
    ("situacao" = 'EM_TRATAMENTO' AND "motivo_encerramento" IS NULL AND "data_encerramento" IS NULL)
    OR ("situacao" = 'FORA_DE_TRATAMENTO' AND "motivo_encerramento" IS NOT NULL AND "data_encerramento" IS NOT NULL)
  )
);

-- Pacientes de teste existentes recebem somente uma ficha vazia; nenhum
-- conteúdo das fichas epicríticas descartadas é convertido.
INSERT INTO "fichas" ("paciente_id", "atualizado_em")
SELECT "id", CURRENT_TIMESTAMP FROM "pacientes";

CREATE TABLE "atendimentos" (
  "id" SERIAL PRIMARY KEY,
  "ficha_id" INTEGER NOT NULL REFERENCES "fichas"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "medico_id" INTEGER NOT NULL REFERENCES "medicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "data_hora_prevista" TIMESTAMPTZ(6) NOT NULL,
  "status" "StatusAtendimento" NOT NULL DEFAULT 'AGENDADA',
  "procedimento" TEXT,
  "procedimento_outro" TEXT,
  "observacoes" TEXT,
  "historico" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "versao" INTEGER NOT NULL DEFAULT 0,
  "google_event_id" VARCHAR(255),
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "atendimentos_procedimento_outro_check" CHECK (
    ("procedimento" = 'Outro' AND NULLIF(BTRIM("procedimento_outro"), '') IS NOT NULL)
    OR ("procedimento" IS DISTINCT FROM 'Outro' AND "procedimento_outro" IS NULL)
  )
);

CREATE INDEX "atendimentos_ficha_id_data_hora_prevista_idx" ON "atendimentos"("ficha_id", "data_hora_prevista");
CREATE INDEX "atendimentos_medico_id_idx" ON "atendimentos"("medico_id");
CREATE INDEX "atendimentos_status_idx" ON "atendimentos"("status");
CREATE INDEX "atendimentos_data_hora_prevista_idx" ON "atendimentos"("data_hora_prevista");
CREATE INDEX "atendimentos_google_event_id_idx" ON "atendimentos"("google_event_id");

CREATE TABLE "midias_atendimento" (
  "id" SERIAL PRIMARY KEY,
  "atendimento_id" INTEGER NOT NULL REFERENCES "atendimentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "chave" VARCHAR(512) NOT NULL UNIQUE,
  "nome_original" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(100) NOT NULL,
  "tamanho_bytes" INTEGER NOT NULL,
  "criado_por_id" INTEGER NOT NULL,
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removido_em" TIMESTAMPTZ(6),
  CONSTRAINT "midias_atendimento_tamanho_check" CHECK ("tamanho_bytes" > 0)
);
CREATE INDEX "midias_atendimento_atendimento_id_removido_em_idx"
  ON "midias_atendimento"("atendimento_id", "removido_em");

COMMIT;
