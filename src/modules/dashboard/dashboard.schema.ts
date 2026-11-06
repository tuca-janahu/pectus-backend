import { z } from "zod";

export const dashboardFiltroSchema = z.object({
  de: z.iso.date(),
  ate: z.iso.date(),
  medicoId: z.coerce.number().int().positive().optional(),
  granularidade: z.enum(["dia", "semana", "mes"]).default("mes"),
}).strict().superRefine((filtro, ctx) => {
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
});

export type DashboardFiltro = z.output<typeof dashboardFiltroSchema>;
