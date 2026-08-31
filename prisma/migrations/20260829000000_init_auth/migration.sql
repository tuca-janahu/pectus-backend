-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('ADMIN', 'MEDICO');

-- CreateEnum
CREATE TYPE "ProvedorAuth" AS ENUM ('LOCAL', 'GOOGLE');

-- CreateTable
CREATE TABLE "contas" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,
    "inativado_em" TIMESTAMPTZ(6),
    CONSTRAINT "contas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contas_papeis" (
    "conta_id" INTEGER NOT NULL,
    "papel" "Papel" NOT NULL,
    CONSTRAINT "contas_papeis_pkey" PRIMARY KEY ("conta_id", "papel")
);

-- CreateTable
CREATE TABLE "identidades_auth" (
    "id" SERIAL NOT NULL,
    "conta_id" INTEGER NOT NULL,
    "provedor" "ProvedorAuth" NOT NULL,
    "provedor_id" TEXT,
    "senha_hash" TEXT,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "identidades_auth_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "identidades_auth_formato_credencial_check" CHECK (
      ("provedor" = 'LOCAL' AND "senha_hash" IS NOT NULL AND "provedor_id" IS NULL)
      OR ("provedor" = 'GOOGLE' AND "provedor_id" IS NOT NULL AND "senha_hash" IS NULL)
    )
);

-- CreateTable
CREATE TABLE "sessoes" (
    "id" SERIAL NOT NULL,
    "conta_id" INTEGER NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "expira_em" TIMESTAMPTZ(6) NOT NULL,
    "revogado_em" TIMESTAMPTZ(6),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contas_email_key" ON "contas"("email");
CREATE UNIQUE INDEX "identidades_auth_conta_id_provedor_key" ON "identidades_auth"("conta_id", "provedor");
CREATE UNIQUE INDEX "identidades_auth_provedor_provedor_id_key" ON "identidades_auth"("provedor", "provedor_id");
CREATE INDEX "sessoes_conta_id_idx" ON "sessoes"("conta_id");
CREATE INDEX "sessoes_expira_em_idx" ON "sessoes"("expira_em");

ALTER TABLE "contas_papeis" ADD CONSTRAINT "contas_papeis_conta_id_fkey"
  FOREIGN KEY ("conta_id") REFERENCES "contas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "identidades_auth" ADD CONSTRAINT "identidades_auth_conta_id_fkey"
  FOREIGN KEY ("conta_id") REFERENCES "contas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_conta_id_fkey"
  FOREIGN KEY ("conta_id") REFERENCES "contas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
