-- AlterEnum
ALTER TYPE "TipoEventoAuditoria" ADD VALUE 'PACIENTE_FOTO_ATUALIZADA';

-- AlterTable
ALTER TABLE "pacientes" ADD COLUMN     "foto_chave" VARCHAR(512);
