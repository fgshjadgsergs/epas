import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppConfig } from '../config/configuration';

const DEFAULT_PRESIGNED_TTL_SECONDS = 3600;

/** Экранирование имени файла для заголовка Content-Disposition (без CRLF/кавычек). */
function sanitizeFilename(name: string): string {
  return name.replace(/[\r\n"\\]/g, '_');
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly isProduction: boolean;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    const s3Config = this.configService.get('s3', { infer: true });
    this.bucket = s3Config.bucket;
    this.isProduction = this.configService.get('nodeEnv', { infer: true }) === 'production';
    this.client = new S3Client({
      endpoint: s3Config.endpoint,
      region: s3Config.region,
      forcePathStyle: s3Config.forcePathStyle,
      credentials: {
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey,
      },
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Создан bucket "${this.bucket}"`);
      } catch (error) {
        // In production a missing/inaccessible bucket should stop the app
        // from starting rather than fail uploads later at request time.
        if (this.isProduction) {
          throw new Error(`Не удалось создать/проверить bucket "${this.bucket}": ${error}`);
        }
        this.logger.warn(`Не удалось создать/проверить bucket "${this.bucket}": ${error}`);
      }
    }
  }

  getBucket(): string {
    return this.bucket;
  }

  async uploadObject(key: string, body: Buffer, mimeType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: mimeType,
      }),
    );
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async getPresignedUrl(key: string, expiresInSeconds = DEFAULT_PRESIGNED_TTL_SECONDS): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  /**
   * Presigned GET с управляемым Content-Disposition: attachment (скачивание) или
   * inline (безопасный preview). Имя файла добавляется в заголовок. TTL —
   * короткоживущий. Presigned-ссылка нигде не сохраняется.
   */
  async getPresignedContentUrl(
    key: string,
    options: { filename?: string; inline?: boolean; expiresInSeconds?: number } = {},
  ): Promise<string> {
    const { filename, inline = false, expiresInSeconds = DEFAULT_PRESIGNED_TTL_SECONDS } = options;
    const disposition = `${inline ? 'inline' : 'attachment'}${filename ? `; filename="${sanitizeFilename(filename)}"` : ''}`;
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: disposition,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  buildPublicUrl(key: string): string | undefined {
    const publicUrl = this.configService.get('s3.publicUrl', { infer: true });
    if (!publicUrl) {
      return undefined;
    }
    return `${publicUrl.replace(/\/$/, '')}/${key}`;
  }
}
