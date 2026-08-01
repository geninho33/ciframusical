import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicEndpoint: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>("S3_ENDPOINT") ?? "http://localhost:9000";
    this.publicEndpoint =
      this.config.get<string>("S3_PUBLIC_ENDPOINT") ?? endpoint;
    this.bucket = this.config.get<string>("S3_BUCKET") ?? "cifratrack";

    this.client = new S3Client({
      region: this.config.get<string>("S3_REGION") ?? "us-east-1",
      endpoint,
      forcePathStyle:
        (this.config.get<string>("S3_FORCE_PATH_STYLE") ?? "true") === "true",
      credentials: {
        accessKeyId: this.config.get<string>("S3_ACCESS_KEY_ID") ?? "cifratrack",
        secretAccessKey:
          this.config.get<string>("S3_SECRET_ACCESS_KEY") ?? "cifratrack_secret",
      },
    });
  }

  async onModuleInit() {
    try {
      await this.ensureBucket();
    } catch (error) {
      this.logger.warn(
        `MinIO/S3 unavailable at boot — uploads will fail until storage is up. ${String(error)}`,
      );
    }
  }

  async ensureBucket() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Created bucket ${this.bucket}`);
    }
  }

  async createPresignedPutUrl(params: {
    key: string;
    mimeType: string;
    expiresInSeconds?: number;
  }) {
    const expiresIn = params.expiresInSeconds ?? 900;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
      ContentType: params.mimeType,
    });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });
    // Rewrite host for browser access when API talks to docker-internal MinIO
    const browserUrl = this.rewriteUrlForBrowser(uploadUrl);
    return {
      uploadUrl: browserUrl,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }

  async createPresignedGetUrl(params: {
    key: string;
    expiresInSeconds?: number;
  }) {
    const expiresIn = params.expiresInSeconds ?? 3600;
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
    });
    const url = await getSignedUrl(this.client, command, { expiresIn });
    return {
      url: this.rewriteUrlForBrowser(url),
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }

  async putObject(params: {
    key: string;
    body: Buffer | string;
    mimeType: string;
  }) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.mimeType,
      }),
    );
  }

  getBucket() {
    return this.bucket;
  }

  private rewriteUrlForBrowser(url: string) {
    const endpoint = this.config.get<string>("S3_ENDPOINT") ?? "http://localhost:9000";
    if (this.publicEndpoint === endpoint) return url;
    return url.replace(endpoint, this.publicEndpoint);
  }
}
