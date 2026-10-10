-- Mantem compativeis os logs historicos gravados antes de o evento ser
-- incorporado ao schema do Prisma. IF NOT EXISTS permite aplicar a migration
-- no banco atual, onde o valor ja esta presente, e tambem em bancos novos.
ALTER TYPE "TipoEventoAuditoria" ADD VALUE IF NOT EXISTS 'USUARIO_FOTO_ATUALIZADA';
