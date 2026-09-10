import { z } from "zod";

const papelSchema = z.enum(["ADMIN", "MEDICO"]);

export const updateContaSchema = z.object({
  nome: z.string().trim().min(1).max(255).optional(),
  roles: z.array(papelSchema).min(1).optional(),
  crm: z.string().trim().min(3).max(50).toUpperCase().optional(),
  ativo: z.boolean().optional(),
});

export type UpdateContaInput = z.input<typeof updateContaSchema>;
export type AtualizarContaInput = z.output<typeof updateContaSchema>;
