-- AlterTable
ALTER TABLE "fichas_epicriticas" ADD COLUMN "google_event_id" VARCHAR(255);

-- CreateIndex
CREATE INDEX "fichas_epicriticas_google_event_id_idx" ON "fichas_epicriticas"("google_event_id");

-- CreateTable
CREATE TABLE "google_calendar_tokens" (
    "id" SERIAL NOT NULL,
    "conta_id" INTEGER NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "access_token" TEXT,
    "expira_em" TIMESTAMPTZ(6),
    "escopo" VARCHAR(500),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "google_calendar_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "google_calendar_tokens_conta_id_key" ON "google_calendar_tokens"("conta_id");

-- AddForeignKey
ALTER TABLE "google_calendar_tokens" ADD CONSTRAINT "google_calendar_tokens_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
