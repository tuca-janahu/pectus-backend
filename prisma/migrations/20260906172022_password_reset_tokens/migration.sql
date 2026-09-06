-- CreateTable
CREATE TABLE "tokens_redefinicao_senha" (
    "id" SERIAL NOT NULL,
    "conta_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_em" TIMESTAMPTZ(6) NOT NULL,
    "usado_em" TIMESTAMPTZ(6),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_redefinicao_senha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tokens_redefinicao_senha_token_hash_key" ON "tokens_redefinicao_senha"("token_hash");

-- CreateIndex
CREATE INDEX "tokens_redefinicao_senha_conta_id_idx" ON "tokens_redefinicao_senha"("conta_id");

-- CreateIndex
CREATE INDEX "tokens_redefinicao_senha_expira_em_idx" ON "tokens_redefinicao_senha"("expira_em");

-- AddForeignKey
ALTER TABLE "tokens_redefinicao_senha" ADD CONSTRAINT "tokens_redefinicao_senha_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
