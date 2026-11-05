import { Router, type Request, type Response } from "express";
import { prisma } from "../../db/prisma";
import { authService } from "../auth/auth.service";

const router = Router();

router.get("/stream", async (req: Request, res: Response) => {
  const token = req.query.token as string | undefined;
  if (!token) return res.status(401).json({ error: "Token não fornecido" });

  const user = await authService.authenticate(token);
  if (!user) return res.status(401).json({ error: "Token inválido" });

  if (!user.roles.includes("MEDICO")) return res.status(403).json({ error: "FORBIDDEN" });

  const medicoId = user.medico?.id;
  if (!medicoId) return res.status(403).json({ error: "Médico não encontrado" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write(": keepalive\n\n");

  const checkInterval = setInterval(async () => {
    try {
      const conta = await prisma.conta.findUnique({
        where: { id: user.id },
        select: { notificacaoAtiva: true, notificacaoAntecedencias: true },
      });

      if (!conta?.notificacaoAtiva || !conta.notificacaoAntecedencias.length) return;

      const now = new Date();

      for (const minutos of conta.notificacaoAntecedencias) {
        const janelaDe = new Date(now.getTime() + (minutos - 2) * 60000);
        const janelaAte = new Date(now.getTime() + (minutos + 2) * 60000);

        const atendimentos = await prisma.atendimento.findMany({
          where: {
            medicoId,
            status: "AGENDADA",
            dataHoraPrevista: { gte: janelaDe, lte: janelaAte },
          },
          include: { ficha: { include: { paciente: { select: { nome: true } } } } },
        });

        for (const atendimento of atendimentos) {
          const eventId = `${atendimento.id}-${minutos}`;
          const pacienteNome = atendimento.ficha.paciente.nome;
          const data = JSON.stringify({
            id: eventId,
            atendimentoId: atendimento.id,
            antecedenciaMinutos: minutos,
            pacienteNome,
            dataHoraPrevista: atendimento.dataHoraPrevista.toISOString(),
          });
          res.write(`event: notificacao\ndata: ${data}\n\n`);
        }
      }
    } catch {
      // Ignore errors — connection may be closing
    }
  }, 60000);

  const keepaliveInterval = setInterval(() => {
    res.write(": keepalive\n\n");
  }, 30000);

  req.on("close", () => {
    clearInterval(checkInterval);
    clearInterval(keepaliveInterval);
  });
});

export default router;
