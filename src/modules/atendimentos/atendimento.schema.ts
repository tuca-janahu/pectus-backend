import { z } from "zod";

export const PROCEDIMENTOS = [
  { nome: "Exame de rotina", descricao: "" },
  { nome: "Traqueoscopia", descricao: "" },
  { nome: "Traqueoscopia + fístula", descricao: "" },
  { nome: "Retirada de tubo T", descricao: "" },
  { nome: "Broncoscopia", descricao: "" },
  { nome: "Pré-operatório", descricao: "" },
  { nome: "Avaliação para decanulação", descricao: "" },
  { nome: "Endoscopia de controle", descricao: "" },
  { nome: "Curativo + avaliação", descricao: "" },
  { nome: "Outro", descricao: "" },
] as const;

const procedimentoSchema = z.object({
  procedimento: z.string().trim().optional().nullable(),
  procedimentoOutro: z.string().trim().max(255).optional().nullable(),
}).superRefine((value, ctx) => {
  if (value.procedimento && !PROCEDIMENTOS.some((item) => item.nome === value.procedimento)) {
    ctx.addIssue({ code: "custom", path: ["procedimento"], message: "Procedimento inválido" });
  }
  if (value.procedimento === "Outro" && !value.procedimentoOutro) {
    ctx.addIssue({ code: "custom", path: ["procedimentoOutro"], message: "Especifique o procedimento" });
  }
  if (value.procedimento !== "Outro" && value.procedimentoOutro) {
    ctx.addIssue({ code: "custom", path: ["procedimentoOutro"], message: "Especificação permitida somente para Outro" });
  }
});

export const camposClinicosSchema = z.object({
  mecanismoLesao: z.string().trim().nullable().optional(),
  dataInjuriaTraqueal: z.coerce.date().nullable().optional(),
  vocaliza: z.boolean().optional(),
  traqueostomizado: z.boolean().optional(),
  possuiComorbidades: z.boolean().optional(),
  comorbidadesDescricao: z.string().trim().nullable().optional(),
  possuiSequelas: z.boolean().optional(),
  sequelasDescricao: z.string().trim().nullable().optional(),
  usaMedicamentos: z.boolean().optional(),
  medicamentosDescricao: z.string().trim().nullable().optional(),
  possuiLaringoscopia: z.boolean().optional(),
  achadoLaringoscopia: z.string().trim().nullable().optional(),
  particularidades: z.string().trim().nullable().optional(),
});

export const criarAtendimentoSchema = z.object({
  pacienteId: z.number().int().positive(),
  medicoId: z.number().int().positive(),
  dataHoraPrevista: z.coerce.date(),
  procedimento: z.string().trim().nullable().optional(),
  procedimentoOutro: z.string().trim().max(255).nullable().optional(),
  observacoes: z.string().trim().nullable().optional(),
}).strict().superRefine((value, ctx) => {
  const result = procedimentoSchema.safeParse(value);
  if (!result.success) result.error.issues.forEach((issue) => ctx.addIssue({ code: "custom", path: issue.path, message: issue.message }));
});

export const atualizarAtendimentoSchema = z.object({
  procedimento: z.string().trim().nullable().optional(),
  procedimentoOutro: z.string().trim().max(255).nullable().optional(),
  observacoes: z.string().trim().nullable().optional(),
  clinico: camposClinicosSchema.optional(),
}).superRefine((value, ctx) => {
  if (value.procedimento !== undefined || value.procedimentoOutro !== undefined) {
    const result = procedimentoSchema.safeParse(value);
    if (!result.success) result.error.issues.forEach((issue) => ctx.addIssue({ code: "custom", path: issue.path, message: issue.message }));
  }
});

export const reagendarAtendimentoSchema = z.object({
  medicoId: z.number().int().positive().optional(),
  dataHoraPrevista: z.coerce.date().optional(),
  procedimento: z.string().trim().nullable().optional(),
  procedimentoOutro: z.string().trim().max(255).nullable().optional(),
  observacoes: z.string().trim().nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.procedimento !== undefined || value.procedimentoOutro !== undefined) {
    const result = procedimentoSchema.safeParse(value);
    if (!result.success) result.error.issues.forEach((issue) => ctx.addIssue({ code: "custom", path: issue.path, message: issue.message }));
  }
});

export const situacaoFichaSchema = z.object({
  situacao: z.enum(["EM_TRATAMENTO", "FORA_DE_TRATAMENTO"]),
  motivoEncerramento: z.enum(["ALTA", "ABANDONO", "OBITO"]).nullable().optional(),
  dataEncerramento: z.coerce.date().nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.situacao === "FORA_DE_TRATAMENTO" && (!value.motivoEncerramento || !value.dataEncerramento)) {
    ctx.addIssue({ code: "custom", message: "Informe motivo e data do encerramento" });
  }
  if (value.situacao === "EM_TRATAMENTO" && (value.motivoEncerramento || value.dataEncerramento)) {
    ctx.addIssue({ code: "custom", message: "Tratamento ativo não possui motivo de encerramento" });
  }
});

export const listarAtendimentosSchema = z.object({
  pacienteId: z.coerce.number().int().positive().optional(),
  medicoId: z.coerce.number().int().positive().optional(),
  estadoCodigo: z.coerce.number().int().positive().optional(),
  municipioCodigo: z.coerce.number().int().positive().optional(),
  status: z.enum(["AGENDADA", "EM_PREENCHIMENTO", "CONCLUIDA", "CANCELADA"]).optional(),
  de: z.coerce.date().optional(),
  ate: z.coerce.date().optional(),
});
