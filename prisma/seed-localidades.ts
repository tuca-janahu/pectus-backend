import "dotenv/config";
import { prisma } from "../src/db/prisma";
import { ESTADOS_IBGE } from "./data/estados-ibge";
import { RM_BELEM_CODIGOS_MUNICIPIO } from "./data/rm-belem-municipios";

const IBGE_MUNICIPIOS_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios";

interface IbgeMunicipio {
  id: number;
  nome: string;
  microrregiao: { mesorregiao: { UF: { id: number } } } | null;
  "regiao-imediata": { "regiao-intermediaria": { UF: { id: number } } };
}

function estadoCodigoDe(m: IbgeMunicipio): number {
  // Um pequeno numero de municipios recem-criados ainda nao tem microrregiao
  // classificada pelo IBGE (ex: Boa Esperanca do Norte/MT, codigo 5101837) —
  // nesse caso cai para a regiao imediata, que sempre tem a UF.
  return m.microrregiao?.mesorregiao.UF.id ?? m["regiao-imediata"]["regiao-intermediaria"].UF.id;
}

async function main() {
  const estadosExistentes = await prisma.estado.count();
  if (estadosExistentes > 0) {
    console.log("Estados/municípios já seedados — pulando (script idempotente).");
    return;
  }

  await prisma.estado.createMany({
    data: ESTADOS_IBGE.map(({ codigo, sigla, nome }) => ({ codigo, sigla, nome })),
  });
  console.log(`${ESTADOS_IBGE.length} estados inseridos.`);

  let municipios: IbgeMunicipio[];
  try {
    const res = await fetch(IBGE_MUNICIPIOS_URL);
    if (!res.ok) throw new Error(`IBGE respondeu ${res.status}`);
    municipios = (await res.json()) as IbgeMunicipio[];
  } catch (error) {
    console.error(
      "Falha ao buscar municípios na API do IBGE. Este é um script de seed manual, executado " +
        "em dev/deploy — nunca em requisições de usuário. Verifique a conectividade e rode " +
        "`npm run seed:localidades` novamente.",
      error,
    );
    process.exitCode = 1;
    return;
  }

  const rmBelemCodigos = new Set<number>(RM_BELEM_CODIGOS_MUNICIPIO);

  await prisma.municipio.createMany({
    data: municipios.map((m) => ({
      codigo: m.id,
      nome: m.nome,
      estadoCodigo: estadoCodigoDe(m),
      pertenceRmBelem: rmBelemCodigos.has(m.id),
    })),
  });
  console.log(`${municipios.length} municípios inseridos.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
