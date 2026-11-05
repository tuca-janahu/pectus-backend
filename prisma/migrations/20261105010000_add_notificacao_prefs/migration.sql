ALTER TABLE "contas"
  ADD COLUMN "notificacao_ativa" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "notificacao_antecedencias" INTEGER[] NOT NULL DEFAULT '{}';
