import { generateStorageKey } from "./key-generator";
import type { GetReadUrlInput, Storage, UploadInput, UploadResult } from "./storage";

export class NoopStorage implements Storage {
  async upload({ folder, contentType }: UploadInput): Promise<UploadResult> {
    const key = generateStorageKey(folder, contentType);
    console.warn(`[storage] S3_* não configuradas - upload não enviado, chave simulada: ${key}`);
    return { key };
  }

  async getReadUrl(_input: GetReadUrlInput): Promise<string> {
    console.warn("[storage] S3_* não configuradas - nenhuma URL assinada será gerada.");
    return "";
  }

  async delete(key: string): Promise<void> {
    console.warn(`[storage] S3_* não configuradas - remoção não realizada para a chave: ${key}`);
  }
}
