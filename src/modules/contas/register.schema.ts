import { z } from "zod";

const papelSchema = z.enum(["ADMIN", "MEDICO"]);

const telefoneSchema = z.string().trim().min(8).max(30);

const medicoSchema = z.object({
  crm: z.string().trim().min(3).max(50).toUpperCase(),
  telefones: z.array(telefoneSchema).max(10).optional().default([]),
});

export const registerSchema = z
  .object({
    nome: z.string().trim().min(1).max(255),
    email: z.string().trim().email().max(320).toLowerCase(),
    roles: z.array(papelSchema).min(1),
    medico: medicoSchema.optional(),
  })
  .superRefine((conta, context) => {
    const possuiPapelMedico = conta.roles.includes("MEDICO");

    if (new Set(conta.roles).size !== conta.roles.length) {
      context.addIssue({
        code: "custom",
        path: ["roles"],
        message: "Os papeis nao podem se repetir.",
      });
    }

    if (possuiPapelMedico && !conta.medico) {
      context.addIssue({
        code: "custom",
        path: ["medico"],
        message: "O perfil medico e obrigatorio para contas com o papel MEDICO.",
      });
    }

    if (!possuiPapelMedico && conta.medico) {
      context.addIssue({
        code: "custom",
        path: ["medico"],
        message: "O perfil medico so pode ser informado para contas com o papel MEDICO.",
      });
    }
  });

export type RegisterInput = z.input<typeof registerSchema>;
export type RegisterData = z.output<typeof registerSchema>;
