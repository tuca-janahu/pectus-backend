import { z } from "zod";

const telefoneSchema = z.string().trim().min(8).max(30);

export const criarPacienteSchema = z.object({
  nome: z.string().trim().min(1).max(255),
  cpf: z
    .string()
    .trim()
    .regex(/^\d{11}$/)
    .optional(),
  dataNascimento: z.coerce.date(),
  genero: z.string().trim().min(1).max(50),
  municipioId: z.number().int().positive().optional(),
  telefones: z.array(telefoneSchema).max(10).optional().default([]),
});

export const atualizarPacienteSchema = z.object({
  nome: z.string().trim().min(1).max(255).optional(),
  cpf: z
    .string()
    .trim()
    .regex(/^\d{11}$/)
    .optional(),
  dataNascimento: z.coerce.date().optional(),
  genero: z.string().trim().min(1).max(50).optional(),
  municipioId: z.number().int().positive().optional(),
  // Sem .default([]) de propósito: se `telefones` não vier no corpo do PATCH, deve
  // permanecer `undefined` (não mexe na lista atual) — um array vazio explícito ([])
  // é o único jeito de esvaziar os telefones de um paciente.
  telefones: z.array(telefoneSchema).max(10).optional(),
  ativo: z.boolean().optional(),
});

export type CriarPacienteInput = z.input<typeof criarPacienteSchema>;
export type CriarPacienteData = z.output<typeof criarPacienteSchema>;
export type AtualizarPacienteInput = z.input<typeof atualizarPacienteSchema>;
export type AtualizarPacienteData = z.output<typeof atualizarPacienteSchema>;
