import { z } from "zod";

export const listLogsSchema = z.object({
  de: z.coerce.date().optional(),
  ate: z.coerce.date().optional(),
  modulo: z.enum(["AUTENTICACAO", "USUARIOS", "PACIENTES"]).optional(),
  busca: z.string().trim().min(1).max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type ListLogsInput = z.input<typeof listLogsSchema>;
export type ListLogsData = z.output<typeof listLogsSchema>;
