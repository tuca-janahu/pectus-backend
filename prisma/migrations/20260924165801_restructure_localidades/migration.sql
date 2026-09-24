-- DropForeignKey
ALTER TABLE "estados" DROP CONSTRAINT "estados_pais_id_fkey";

-- DropForeignKey
ALTER TABLE "pacientes" DROP CONSTRAINT "pacientes_estado_id_fkey";

-- DropIndex
DROP INDEX "estados_pais_id_sigla_key";

-- DropIndex
DROP INDEX "pacientes_estado_id_idx";

-- AlterTable
ALTER TABLE "estados" DROP CONSTRAINT "estados_pkey",
DROP COLUMN "id",
DROP COLUMN "pais_id",
ADD COLUMN     "codigo" INTEGER NOT NULL,
ALTER COLUMN "sigla" SET DATA TYPE VARCHAR(2),
ADD CONSTRAINT "estados_pkey" PRIMARY KEY ("codigo");

-- AlterTable
ALTER TABLE "pacientes" DROP COLUMN "estado_id",
DROP COLUMN "municipio",
ADD COLUMN     "municipio_id" INTEGER;

-- DropTable
DROP TABLE "paises";

-- CreateTable
CREATE TABLE "municipios" (
    "codigo" INTEGER NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "estado_codigo" INTEGER NOT NULL,
    "pertence_rm_belem" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "municipios_pkey" PRIMARY KEY ("codigo")
);

-- CreateIndex
CREATE INDEX "municipios_estado_codigo_idx" ON "municipios"("estado_codigo");

-- CreateIndex
CREATE UNIQUE INDEX "estados_sigla_key" ON "estados"("sigla");

-- CreateIndex
CREATE INDEX "pacientes_municipio_id_idx" ON "pacientes"("municipio_id");

-- AddForeignKey
ALTER TABLE "municipios" ADD CONSTRAINT "municipios_estado_codigo_fkey" FOREIGN KEY ("estado_codigo") REFERENCES "estados"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacientes" ADD CONSTRAINT "pacientes_municipio_id_fkey" FOREIGN KEY ("municipio_id") REFERENCES "municipios"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

