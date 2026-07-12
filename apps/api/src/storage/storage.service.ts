import { randomUUID } from 'node:crypto';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';

/**
 * Almacenamiento de archivos (CVs, PDFs) en un backend S3-compatible.
 * En desarrollo apunta a MinIO (docker-compose.dev). Crea el bucket si falta.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket = process.env.S3_BUCKET ?? 'nab-uploads';

  constructor() {
    this.client = new S3Client({
      region: process.env.S3_REGION ?? 'us-east-1',
      endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
      forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY ?? 'minio',
        secretAccessKey: process.env.S3_SECRET_KEY ?? 'minio12345',
      },
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Bucket "${this.bucket}" creado.`);
      } catch (err) {
        this.logger.warn(`No se pudo asegurar el bucket "${this.bucket}": ${String(err)}`);
      }
    }
  }

  /** Sube un buffer y devuelve la key del objeto. */
  async upload(prefix: string, filename: string, body: Buffer, contentType: string): Promise<string> {
    const key = `${prefix}/${randomUUID()}-${filename}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return key;
  }

  /** Descarga un objeto como buffer. */
  async download(key: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }
}
