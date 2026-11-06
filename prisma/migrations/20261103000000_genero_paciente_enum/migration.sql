-- Valores antigos em minúsculas são equivalentes aos novos valores do enum.
-- Qualquer outro valor exige correção cadastral antes de aplicar a migração.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "pacientes"
    WHERE UPPER(BTRIM("genero")) NOT IN ('MASCULINO', 'FEMININO')
  ) THEN
    RAISE EXCEPTION 'Existem pacientes com gênero fora de MASCULINO/FEMININO. Corrija os cadastros antes da migração.';
  END IF;
END $$;

CREATE TYPE "GeneroPaciente" AS ENUM ('MASCULINO', 'FEMININO');
ALTER TABLE "pacientes" ALTER COLUMN "genero" TYPE "GeneroPaciente"
  USING UPPER(BTRIM("genero"))::"GeneroPaciente";
