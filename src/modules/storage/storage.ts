export interface UploadInput {
  folder: string;
  body: Buffer;
  contentType: string;
}

export interface UploadResult {
  key: string;
}

export interface GetReadUrlInput {
  key: string;
  expiresInSeconds?: number;
}

export interface Storage {
  upload(input: UploadInput): Promise<UploadResult>;
  getReadUrl(input: GetReadUrlInput): Promise<string>;
  delete(key: string): Promise<void>;
}
