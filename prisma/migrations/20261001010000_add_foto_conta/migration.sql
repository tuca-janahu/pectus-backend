-- AlterEnum
ALTER TYPE "TipoEventoAuditoria" ADD VALUE 'USUARIO_FOTO_ATUALIZADA';

-- AlterTable
ALTER TABLE "contas" ADD COLUMN     "foto_chave" VARCHAR(512);
