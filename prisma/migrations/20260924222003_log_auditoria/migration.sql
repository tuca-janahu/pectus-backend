-- CreateEnum
CREATE TYPE "ModuloAuditoria" AS ENUM ('AUTENTICACAO', 'USUARIOS', 'PACIENTES');

-- CreateEnum
CREATE TYPE "TipoEventoAuditoria" AS ENUM ('LOGIN_SUCESSO', 'LOGIN_FALHA', 'USUARIO_CRIADO', 'USUARIO_ATIVADO_ADMIN', 'USUARIO_DESATIVADO_ADMIN', 'USUARIO_ATIVADO_PROPRIO', 'PACIENTE_CRIADO');

-- CreateTable
CREATE TABLE "logs_auditoria" (
    "id" SERIAL NOT NULL,
    "modulo" "ModuloAuditoria" NOT NULL,
    "tipo" "TipoEventoAuditoria" NOT NULL,
    "descricao" VARCHAR(500) NOT NULL,
    "ator_id" INTEGER,
    "metadata" JSONB,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "logs_auditoria_modulo_idx" ON "logs_auditoria"("modulo");

-- CreateIndex
CREATE INDEX "logs_auditoria_tipo_idx" ON "logs_auditoria"("tipo");

-- CreateIndex
CREATE INDEX "logs_auditoria_criado_em_idx" ON "logs_auditoria"("criado_em");

-- CreateIndex
CREATE INDEX "logs_auditoria_ator_id_idx" ON "logs_auditoria"("ator_id");

-- AddForeignKey
ALTER TABLE "logs_auditoria" ADD CONSTRAINT "logs_auditoria_ator_id_fkey" FOREIGN KEY ("ator_id") REFERENCES "contas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

