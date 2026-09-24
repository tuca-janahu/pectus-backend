// Municípios da Região Metropolitana de Belém (RMB), definida por lei estadual do Pará.
// A composição já mudou 4 vezes desde a criação em 1973 (últimas alterações: 1995, 2010,
// 2011 e 2023, com a inclusão de Barcarena) — por isso o flag `pertenceRmBelem` em
// `Municipio` deve ser editável via admin depois do seed, não só fixo aqui.
export const RM_BELEM_CODIGOS_MUNICIPIO = [
  1501402, // Belém
  1500800, // Ananindeua
  1504422, // Marituba
  1501501, // Benevides
  1506351, // Santa Bárbara do Pará
  1506500, // Santa Izabel do Pará
  1502400, // Castanhal
  1501303, // Barcarena
] as const;
