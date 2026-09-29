export const storageConfig = {
  endpoint: process.env.S3_ENDPOINT || "",
  region: process.env.S3_REGION || "garage",
  bucket: process.env.S3_BUCKET || "",
  accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  presignedUrlExpirySeconds: Number(process.env.S3_PRESIGNED_URL_EXPIRY_SECONDS) || 300,
};
