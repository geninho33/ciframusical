import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  /** Client for server-side ops (may use docker-internal endpoint). */
  private readonly client: S3Client;
  /**
   * Client used only for browser-facing presigned URLs.
   * Must target S3_PUBLIC_ENDPOINT so SigV4 Host matches the browser PUT/GET.
   */
  private readonly signingClient: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;
  private readonly publicEndpoint: string;

  constructor(private readonly config: ConfigService) {
    this.endpoint =
      this.config.get<string>("S3_ENDPOINT")?.trim() ||
      "http://localhost:9000";
    this.publicEndpoint =
      this.config.get<string>("S3_PUBLIC_ENDPOINT")?.trim() || this.endpoint;
    this.bucket = this.config.get<string>("S3_BUCKET")?.trim() || "cifratrack";

    const region = this.config.get<string>("S3_REGION") ?? "us-east-1";
    const forcePathStyle =
      (this.config.get<string>("S3_FORCE_PATH_STYLE") ?? "true") === "true";
    const credentials = {
      accessKeyId: this.config.get<string>("S3_ACCESS_KEY_ID") ?? "cifratrack",
      secretAccessKey:
        this.config.get<string>("S3_SECRET_ACCESS_KEY") ?? "cifratrack_secret",
    };

    this.client = new S3Client({
      region,
      endpoint: this.endpoint,
      forcePathStyle,
      credentials,
    });

    this.signingClient =
      this.publicEndpoint === this.endpoint
        ? this.client
        : new S3Client({
            region,
            endpoint: this.publicEndpoint,
            forcePathStyle,
            credentials,
          });
  }

  async onModuleInit() {
    try {
      await this.ensureBucket();
      await this.ensureCors();
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

  /**
   * Apply browser CORS for AWS S3.
   * Community MinIO ignores bucket CORS — use MINIO_API_CORS_ALLOW_ORIGIN instead.
   */
  async ensureCors() {
    const origins = this.resolveCorsOrigins();
    if (origins.length === 0) {
      this.logger.warn("No S3 CORS origins configured — browser uploads may fail");
      return;
    }

    try {
      await this.client.send(
        new PutBucketCorsCommand({
          Bucket: this.bucket,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedOrigins: origins,
                AllowedMethods: ["GET", "PUT", "HEAD", "POST", "DELETE"],
                AllowedHeaders: ["*"],
                ExposeHeaders: ["ETag", "x-amz-request-id", "x-amz-version-id"],
                MaxAgeSeconds: 3000,
              },
            ],
          },
        }),
      );
      this.logger.log(`S3 bucket CORS applied for origins: ${origins.join(", ")}`);
    } catch (error) {
      this.logger.warn(
        `Bucket CORS not applied (expected on MinIO community). ` +
          `Set MINIO_API_CORS_ALLOW_ORIGIN=${origins.join(",")}. ` +
          `Detail: ${String(error)}`,
      );
    }
  }

  async createPresignedPutUrl(params: {
    key: string;
    mimeType: string;
    expiresInSeconds?: number;
  }) {
    const expiresIn = params.expiresInSeconds ?? 900;
    const contentType = params.mimeType.trim();
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
      ContentType: contentType,
    });

    // Sign with the public endpoint client — never rewrite host after signing.
    const uploadUrl = await getSignedUrl(this.signingClient, command, {
      expiresIn,
      signableHeaders: new Set(["content-type"]),
    });

    this.assertSignedContentType(uploadUrl, contentType);

    return {
      uploadUrl,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      headers: { "Content-Type": contentType },
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
    const url = await getSignedUrl(this.signingClient, command, { expiresIn });
    return {
      url,
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

  private resolveCorsOrigins(): string[] {
    const fromS3 =
      this.config.get<string>("S3_CORS_ORIGINS")?.trim() ||
      this.config.get<string>("API_CORS_ORIGIN")?.trim() ||
      "";
    const list = fromS3
      .split(",")
      .map((o) => o.trim())
      .filter((o) => o && o !== "*");

    const defaults = [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:8088",
      "http://127.0.0.1:8088",
    ];
    return [...new Set([...list, ...defaults])];
  }

  private assertSignedContentType(uploadUrl: string, contentType: string) {
    try {
      const signedHeaders = new URL(uploadUrl).searchParams.get(
        "X-Amz-SignedHeaders",
      );
      if (!signedHeaders?.split(";").includes("content-type")) {
        this.logger.warn(
          `Presigned PUT missing content-type in SignedHeaders (got: ${signedHeaders})`,
        );
      }
    } catch {
      this.logger.warn("Could not parse presigned PUT URL for SignedHeaders check");
    }

    // Ensure caller/browser can match the signed Content-Type exactly.
    if (!contentType) {
      throw new Error("Presigned PUT requires a non-empty Content-Type");
    }
  }
}
