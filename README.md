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

Nunca use `prisma db push` como fluxo normal e não execute migrations contra
producao sem a `DATABASE_URL` de producao explicitamente configurada.

## Endpoint inicial

- `GET /health` retorna `{ "status": "ok" }`

## Fichas epicríticas

As rotas exigem autenticação e papel `ADMIN` ou `MEDICO`:

- `GET /fichas-epicriticas` lista fichas e aceita `pacienteId`, `medicoId`, `status`, `de` e `ate`.
- `POST /fichas-epicriticas` agenda uma ficha; aceita `procedimento` e `observacoes`, e `iniciarAgora: true` abre o atendimento imediatamente.
- `GET /fichas-epicriticas/:id` retorna uma ficha.
- `PATCH /fichas-epicriticas/:id/agendamento` altera médico ou data enquanto a ficha está agendada.
- `POST /fichas-epicriticas/:id/iniciar` inicia o atendimento e herda os dados clínicos da última ficha concluída do paciente.
- `PATCH /fichas-epicriticas/:id` salva os dados clínicos enquanto a ficha está em preenchimento.
- `POST /fichas-epicriticas/:id/concluir` conclui a ficha.
- `POST /fichas-epicriticas/:id/cancelar` cancela uma ficha aberta.

Uma ficha agendada mantém os defaults do banco. A herança ocorre apenas ao iniciar o atendimento, para usar a ficha concluída mais recente; `observacoes` não é herdado por ser específico de cada consulta.
