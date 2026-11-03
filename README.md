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

## Atendimentos e ficha longitudinal

As rotas exigem autenticação e papel `ADMIN` ou `MEDICO`:

- `GET /atendimentos` lista atendimentos e aceita `pacienteId`, `medicoId`, `status`, `de` e `ate`.
- `POST /atendimentos` exige `pacienteId`, `medicoId` e `dataHoraPrevista` futura; aceita procedimento e observações. Cria sempre com status `AGENDADA` e não aceita `iniciarAgora`.
- `GET /atendimentos/:id` consulta um atendimento.
- `PATCH /atendimentos/:id/agendamento` altera o agendamento enquanto estiver em `AGENDADA`.
- `POST /atendimentos/:id/iniciar` muda para `EM_PREENCHIMENTO` e disponibiliza a ficha clínica longitudinal.
- `PATCH /atendimentos/:id` salva os dados clínicos durante o preenchimento.
- `POST /atendimentos/:id/concluir` conclui; `POST /atendimentos/:id/cancelar` cancela um atendimento aberto.

O início do atendimento é uma ação separada do agendamento. Observações pertencem ao atendimento; os dados clínicos persistentes pertencem à ficha única do paciente.
