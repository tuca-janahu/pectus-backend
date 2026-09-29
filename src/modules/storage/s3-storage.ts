import { DeleteObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { storageConfig } from "../../config/storage";
import { generateStorageKey } from "./key-generator";
import type { GetReadUrlInput, Storage, UploadInput, UploadResult } from "./storage";

export class S3Storage implements Storage {
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string = storageConfig.bucket,
    endpoint: string = storageConfig.endpoint,
    region: string = storageConfig.region,
    accessKeyId: string = storageConfig.accessKeyId,
    secretAccessKey: string = storageConfig.secretAccessKey,
    private readonly defaultExpiresInSeconds: number = storageConfig.presignedUrlExpirySeconds,
  ) {
    this.client = new S3Client({
      endpoint,
      region,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async upload({ folder, body, contentType }: UploadInput): Promise<UploadResult> {
    const key = generateStorageKey(folder, contentType);
    const upload = new Upload({
      client: this.client,
      params: { Bucket: this.bucket, Key: key, Body: body, ContentType: contentType },
    });
    await upload.done();
    return { key };
  }

  async getReadUrl({ key, expiresInSeconds = this.defaultExpiresInSeconds }: GetReadUrlInput): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
