import { storageConfig } from "../../config/storage";
import { NoopStorage } from "./noop-storage";
import { S3Storage } from "./s3-storage";
import type { Storage } from "./storage";

export type { GetReadUrlInput, Storage, UploadInput, UploadResult } from "./storage";
export { NoopStorage } from "./noop-storage";
export { S3Storage } from "./s3-storage";

const isConfigured =
  !!storageConfig.endpoint && !!storageConfig.bucket && !!storageConfig.accessKeyId && !!storageConfig.secretAccessKey;

if (!isConfigured) {
  console.warn("S3_* não definidas - uploads serao apenas logados no console (NoopStorage).");
}

export const storage: Storage = isConfigured ? new S3Storage() : new NoopStorage();
