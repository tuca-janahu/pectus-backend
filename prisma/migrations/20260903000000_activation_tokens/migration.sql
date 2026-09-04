CREATE TABLE "tokens_ativacao" (
    "id" SERIAL NOT NULL,
    "conta_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_em" TIMESTAMPTZ(6) NOT NULL,
    "usado_em" TIMESTAMPTZ(6),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tokens_ativacao_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tokens_ativacao_token_hash_key" ON "tokens_ativacao"("token_hash");
CREATE INDEX "tokens_ativacao_conta_id_idx" ON "tokens_ativacao"("conta_id");
CREATE INDEX "tokens_ativacao_expira_em_idx" ON "tokens_ativacao"("expira_em");

ALTER TABLE "tokens_ativacao" ADD CONSTRAINT "tokens_ativacao_conta_id_fkey"
  FOREIGN KEY ("conta_id") REFERENCES "contas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
