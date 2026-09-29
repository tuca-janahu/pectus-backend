import { randomBytes } from "node:crypto";

const EXTENSOES_POR_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export function generateStorageKey(folder: string, contentType: string): string {
  const pasta = folder.replace(/^\/+|\/+$/g, "");
  const nomeArquivo = randomBytes(16).toString("hex");
  const extensao = EXTENSOES_POR_CONTENT_TYPE[contentType];
  const arquivo = extensao ? `${nomeArquivo}.${extensao}` : nomeArquivo;
  return pasta ? `${pasta}/${arquivo}` : arquivo;
}
