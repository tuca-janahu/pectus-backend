import { z } from "zod";

export const updateMunicipioSchema = z.object({
  pertenceRmBelem: z.boolean(),
});

export type UpdateMunicipioInput = z.input<typeof updateMunicipioSchema>;
export type AtualizarMunicipioInput = z.output<typeof updateMunicipioSchema>;
