import { z } from "zod";

const baseFiltroSchema = z.object({
  de: z.iso.date(),
  ate: z.iso.date(),
  medicoId: z.coerce.number().int().positive().optional(),
  estadoCodigo: z.coerce.number().int().positive().optional(),
  municipioCodigo: z.coerce.number().int().positive().optional(),
  granularidade: z.enum(["dia", "semana", "mes"]).default("mes"),
}).strict();

function validarPeriodo(filtro: { de: string; ate: string; granularidade: "dia" | "semana" | "mes" }, ctx: z.RefinementCtx) {
  const inicio = new Date(`${filtro.de}T00:00:00Z`);
  const fim = new Date(`${filtro.ate}T00:00:00Z`);
  if (fim < inicio) ctx.addIssue({ code: "custom", path: ["ate"], message: "A data final deve ser igual ou posterior à inicial" });
  if ((fim.getTime() - inicio.getTime()) / 86_400_000 > 731) {
    ctx.addIssue({ code: "custom", path: ["ate"], message: "O período máximo é de dois anos" });
  }
  const dias = (fim.getTime() - inicio.getTime()) / 86_400_000;
  if (filtro.granularidade === "dia" && dias > 90) {
    ctx.addIssue({ code: "custom", path: ["granularidade"], message: "A visão diária aceita até 90 dias" });
  }
  if (filtro.granularidade === "semana" && dias > 365) {
    ctx.addIssue({ code: "custom", path: ["granularidade"], message: "A visão semanal aceita até um ano" });
  }
}

export const dashboardFiltroSchema = baseFiltroSchema.superRefine((filtro, ctx) => {
  if (filtro.municipioCodigo && !filtro.estadoCodigo) {
    ctx.addIssue({ code: "custom", path: ["municipioCodigo"], message: "Selecione um estado para filtrar o município" });
  }
  validarPeriodo(filtro, ctx);
});

export type DashboardFiltro = z.output<typeof dashboardFiltroSchema>;

export const dashboardMapaFiltroSchema = baseFiltroSchema.omit({ municipioCodigo: true, granularidade: true })
  .superRefine((filtro, ctx) => validarPeriodo({ ...filtro, granularidade: "mes" }, ctx));
export type DashboardMapaFiltro = z.output<typeof dashboardMapaFiltroSchema>;
