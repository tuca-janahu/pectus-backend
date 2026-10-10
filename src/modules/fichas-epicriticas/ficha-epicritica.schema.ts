import { z } from "zod";

const camposClinicos = {
  procedimento: z.string().trim().nullable().optional(),
  observacoes: z.string().trim().nullable().optional(),
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
} as const;

export const criarFichaEpicriticaSchema = z.object({
  pacienteId: z.number().int().positive(),
  medicoId: z.number().int().positive(),
  dataHoraPrevista: z.coerce.date().optional(),
  procedimento: z.string().trim().nullable().optional(),
  observacoes: z.string().trim().nullable().optional(),
  iniciarAgora: z.boolean().optional().default(false),
});

export const atualizarFichaEpicriticaSchema = z.object(camposClinicos);

export const reagendarFichaEpicriticaSchema = z.object({
  medicoId: z.number().int().positive().optional(),
  dataHoraPrevista: z.coerce.date().optional(),
  procedimento: z.string().trim().nullable().optional(),
  observacoes: z.string().trim().nullable().optional(),
}).refine((data) => Object.values(data).some((value) => value !== undefined), {
  message: "Informe ao menos um campo para reagendar a ficha",
});

export const listarFichasEpicriticasSchema = z.object({
  pacienteId: z.coerce.number().int().positive().optional(),
  medicoId: z.coerce.number().int().positive().optional(),
  status: z.enum(["AGENDADA", "EM_PREENCHIMENTO", "CONCLUIDA", "CANCELADA"]).optional(),
  de: z.coerce.date().optional(),
  ate: z.coerce.date().optional(),
}).refine((data) => !data.de || !data.ate || data.de <= data.ate, {
  message: "A data inicial deve ser anterior ou igual à data final",
});

export type CriarFichaEpicriticaInput = z.input<typeof criarFichaEpicriticaSchema>;
export type CriarFichaEpicriticaData = z.output<typeof criarFichaEpicriticaSchema>;
export type AtualizarFichaEpicriticaInput = z.input<typeof atualizarFichaEpicriticaSchema>;
export type AtualizarFichaEpicriticaData = z.output<typeof atualizarFichaEpicriticaSchema>;
export type ReagendarFichaEpicriticaInput = z.input<typeof reagendarFichaEpicriticaSchema>;
export type ReagendarFichaEpicriticaData = z.output<typeof reagendarFichaEpicriticaSchema>;
export type ListarFichasEpicriticasInput = z.input<typeof listarFichasEpicriticasSchema>;
export type ListarFichasEpicriticasFiltro = z.output<typeof listarFichasEpicriticasSchema>;
