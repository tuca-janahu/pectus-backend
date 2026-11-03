import { Router } from "express";
import type { NextFunction, Request } from "express";
import multer from "multer";
import type { Response } from "express";
import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../db/prisma";
import { authenticate, authorize } from "../../middleware/authMiddleware";
import { mensagemDeErro } from "../../shared/error-message";
import { emailsDosAutores, historicoComEmails } from "../../shared/historico-autores";
import { AtendimentoErro, AtendimentoService, type Ator } from "./atendimento.service";
import { PROCEDIMENTOS } from "./atendimento.schema";
import { NoopStorage, storage } from "../storage";

const router = Router();
const service = new AtendimentoService(prisma);

async function atendimentosComAutores<T extends { historico: Prisma.JsonValue }>(atendimentos: T[]) {
  const emails = await emailsDosAutores(prisma, atendimentos.map((item) => item.historico));
  return atendimentos.map((item) => ({ ...item, historico: historicoComEmails(item.historico, emails) }));
}

async function atendimentoComAutores<T extends { historico: Prisma.JsonValue }>(atendimento: T) {
  return (await atendimentosComAutores([atendimento]))[0];
}
const LIMITE_VIDEO_BYTES = Number(process.env.MAX_VIDEO_MB ?? 100) * 1024 * 1024;
const uploadMidia = multer({ storage: multer.memoryStorage(), limits: { fileSize: Math.max(5 * 1024 * 1024, LIMITE_VIDEO_BYTES) } });
const receberMidia = (req: Request, res: Response, next: NextFunction) => {
  uploadMidia.single("arquivo")(req, res, (error) => {
    if (error) return res.status(413).json({ error: "Arquivo excede o limite permitido" });
    next();
  });
};
router.use(authenticate, authorize("ADMIN", "MEDICO"));

function ator(res: Response): Ator {
  return res.locals.user as Ator;
}

function id(value: string | undefined) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new AtendimentoErro("ID inválido", 400);
  return parsed;
}

function erro(res: Response, error: unknown) {
  if (error instanceof AtendimentoErro) return res.status(error.status).json({ error: error.message });
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2004" || error.code === "P2034") {
      return res.status(409).json({ error: "Conflito de horário ou alteração simultânea" });
    }
  }
  return res.status(400).json({ error: mensagemDeErro(error) });
}

function midiaValida(arquivo: Express.Multer.File) {
  const b = arquivo.buffer;
  if (arquivo.mimetype === "image/jpeg") {
    return b.length <= 5 * 1024 * 1024 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  }
  if (arquivo.mimetype === "image/png") {
    return b.length <= 5 * 1024 * 1024 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  return arquivo.mimetype === "video/mp4" && b.length <= LIMITE_VIDEO_BYTES && b.toString("ascii", 4, 8) === "ftyp";
}

async function atendimentoParaMidia(idAtendimento: number, usuario: Ator) {
  const atendimento = await service.buscarPorId(idAtendimento);
  if (atendimento.status === "CANCELADA") throw new AtendimentoErro("Atendimento cancelado não pode receber mídia", 409);
  if (atendimento.status === "CONCLUIDA") {
    if (!usuario.roles.includes("MEDICO")) throw new AtendimentoErro("Correção exige perfil médico", 403);
  } else if (!usuario.roles.includes("ADMIN") && usuario.medico?.id !== atendimento.medicoId) {
    throw new AtendimentoErro("Somente o médico responsável pode alterar atendimento aberto", 403);
  }
  return atendimento;
}

router.get("/procedimentos", (_req, res) => res.json({ procedimentos: PROCEDIMENTOS }));
router.get("/pacientes/:pacienteId/ficha", async (req, res) => {
  try { res.json({ ficha: await service.fichaDoPaciente(id(req.params.pacienteId as string)) }); }
  catch (error) { erro(res, error); }
});
router.get("/atendimentos", async (req, res) => {
  try { res.json({ atendimentos: await atendimentosComAutores(await service.listar(req.query)) }); }
  catch (error) { erro(res, error); }
});
router.post("/atendimentos", async (req, res) => {
  try { res.status(201).json({ atendimento: await atendimentoComAutores(await service.criar(req.body, ator(res))) }); }
  catch (error) { erro(res, error); }
});
router.get("/atendimentos/:id", async (req, res) => {
  try { res.json({ atendimento: await atendimentoComAutores(await service.buscarPorId(id(req.params.id as string))) }); }
  catch (error) { erro(res, error); }
});
router.patch("/atendimentos/:id/agendamento", async (req, res) => {
  try { res.json({ atendimento: await atendimentoComAutores(await service.reagendar(id(req.params.id as string), req.body, ator(res))) }); }
  catch (error) { erro(res, error); }
});
router.patch("/atendimentos/:id", async (req, res) => {
  try { res.json({ atendimento: await atendimentoComAutores(await service.atualizar(id(req.params.id as string), req.body, ator(res))) }); }
  catch (error) { erro(res, error); }
});
router.post("/atendimentos/:id/iniciar", async (req, res) => {
  try { res.json({ atendimento: await atendimentoComAutores(await service.iniciar(id(req.params.id as string), ator(res))) }); }
  catch (error) { erro(res, error); }
});
router.post("/atendimentos/:id/concluir", async (req, res) => {
  try { res.json({ atendimento: await atendimentoComAutores(await service.concluir(id(req.params.id as string), ator(res))) }); }
  catch (error) { erro(res, error); }
});
router.post("/atendimentos/:id/cancelar", async (req, res) => {
  try { res.json({ atendimento: await atendimentoComAutores(await service.cancelar(id(req.params.id as string), ator(res))) }); }
  catch (error) { erro(res, error); }
});
router.post("/atendimentos/:id/corrigir", async (req, res) => {
  try { res.json({ atendimento: await atendimentoComAutores(await service.atualizar(id(req.params.id as string), req.body, ator(res), true)) }); }
  catch (error) { erro(res, error); }
});
router.post("/atendimentos/:id/situacao", async (req, res) => {
  try { res.json({ atendimento: await atendimentoComAutores(await service.alterarSituacao(id(req.params.id as string), req.body, ator(res))) }); }
  catch (error) { erro(res, error); }
});

router.get("/atendimentos/:id/midias", async (req, res) => {
  try {
    const atendimentoId = id(req.params.id as string);
    await service.buscarPorId(atendimentoId);
    const midias = await prisma.midiaAtendimento.findMany({ where: { atendimentoId, removidoEm: null }, orderBy: { criadoEm: "asc" } });
    res.json({ midias: await Promise.all(midias.map(async ({ chave, ...midia }) => ({ ...midia, url: await storage.getReadUrl({ key: chave, expiresInSeconds: 3600 }) }))) });
  } catch (error) { erro(res, error); }
});

router.post("/atendimentos/:id/midias", receberMidia, async (req, res) => {
  try {
    const atendimentoId = id(req.params.id as string);
    await atendimentoParaMidia(atendimentoId, ator(res));
    if (!req.file || !midiaValida(req.file)) throw new AtendimentoErro("Use JPEG/PNG até 5 MB ou MP4 dentro do limite configurado", 400);
    if (storage instanceof NoopStorage) throw new AtendimentoErro("Armazenamento de mídia não configurado", 503);
    const { key } = await storage.upload({ folder: `atendimentos/${atendimentoId}`, body: req.file.buffer, contentType: req.file.mimetype });
    try {
      const url = await storage.getReadUrl({ key, expiresInSeconds: 3600 });
      const midia = await prisma.$transaction(async (tx) => {
        const atual = await tx.atendimento.findUniqueOrThrow({ where: { id: atendimentoId } });
        const midiaCriada = await tx.midiaAtendimento.create({ data: {
          atendimentoId, chave: key, nomeOriginal: req.file!.originalname.slice(0, 255),
          mimeType: req.file!.mimetype, tamanhoBytes: req.file!.size, criadoPorId: ator(res).id,
        } });
        const historico = Array.isArray(atual.historico) ? [...atual.historico] : [];
        historico.push({ tipo: "MIDIA_ADICIONADA", em: new Date().toISOString(), autorContaId: ator(res).id,
          campos: { midiaId: midiaCriada.id, nomeOriginal: midiaCriada.nomeOriginal, mimeType: midiaCriada.mimeType } });
        await tx.atendimento.update({ where: { id: atendimentoId }, data: { historico } });
        return midiaCriada;
      }, { isolationLevel: "Serializable" });
      res.status(201).json({ midia: { ...midia, url } });
    } catch (error) { await storage.delete(key).catch(() => {}); throw error; }
  } catch (error) { erro(res, error); }
});

router.delete("/atendimentos/:id/midias/:midiaId", async (req, res) => {
  try {
    const atendimentoId = id(req.params.id as string);
    await atendimentoParaMidia(atendimentoId, ator(res));
    const midia = await prisma.midiaAtendimento.findFirst({ where: { id: id(req.params.midiaId as string), atendimentoId, removidoEm: null } });
    if (!midia) throw new AtendimentoErro("Mídia não encontrada", 404);
    await prisma.$transaction(async (tx) => {
      const atual = await tx.atendimento.findUniqueOrThrow({ where: { id: atendimentoId } });
      await tx.midiaAtendimento.update({ where: { id: midia.id }, data: { removidoEm: new Date() } });
      const historico = Array.isArray(atual.historico) ? [...atual.historico] : [];
      historico.push({ tipo: "MIDIA_REMOVIDA", em: new Date().toISOString(), autorContaId: ator(res).id,
        campos: { midiaId: midia.id, nomeOriginal: midia.nomeOriginal } });
      await tx.atendimento.update({ where: { id: atendimentoId }, data: { historico } });
    }, { isolationLevel: "Serializable" });
    res.status(204).end();
  } catch (error) { erro(res, error); }
});

export default router;
