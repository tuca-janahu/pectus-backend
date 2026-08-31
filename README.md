# pectus-backend

Estrutura basica de backend em TypeScript com Express.

## Requisitos

- Node.js 20+

## Como rodar

1. Instalar dependencias:

```bash
npm install
```

2. Rodar em desenvolvimento:

```bash
npm run dev
```

3. Build de producao:

```bash
npm run build
npm start
```

## Banco de dados

O projeto usa PostgreSQL e Prisma. Copie `.env.example` para `.env` e ajuste
`DATABASE_URL` para a instancia local. O banco de testes deve permanecer
separado, configurado em `DATABASE_URL_TEST`.

Para aplicar a migration inicial no banco configurado:

```bash
npm run prisma:deploy
```

Durante o desenvolvimento, novas migrations devem ser criadas com:

```bash
npm run prisma:migrate -- --name descricao_da_mudanca
```

Nunca use `prisma db push` como fluxo normal e nao execute migrations contra
producao sem a `DATABASE_URL` de producao explicitamente configurada.

## Endpoint inicial

- `GET /health` retorna `{ "status": "ok" }`
