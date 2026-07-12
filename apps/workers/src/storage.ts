import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

/** Cliente S3/MinIO para que los workers descarguen archivos (CVs). */
const client = new S3Client({
  region: process.env.S3_REGION ?? 'us-east-1',
  endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
  forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? 'minio',
    secretAccessKey: process.env.S3_SECRET_KEY ?? 'minio12345',
  },
});

const BUCKET = process.env.S3_BUCKET ?? 'nab-uploads';

export async function downloadObject(key: string): Promise<Buffer> {
  const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const bytes = await res.Body!.transformToByteArray();
  return Buffer.from(bytes);
}
