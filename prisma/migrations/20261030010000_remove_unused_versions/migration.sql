-- Os contadores nunca foram utilizados em verificacoes de concorrencia.
ALTER TABLE "fichas" DROP COLUMN "versao";
ALTER TABLE "atendimentos" DROP COLUMN "versao";
