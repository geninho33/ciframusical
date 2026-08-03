import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Readable } from "stream";

function envOr(config: ConfigService, key: string, fallback: string) {
  const value = config.get<string>(key)?.trim();
  return value ? value : fallback;
}

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
  private readonly accessKeyId: string;

  constructor(private readonly config: ConfigService) {
    this.endpoint = envOr(config, "S3_ENDPOINT", "http://localhost:9000");
    this.publicEndpoint = envOr(config, "S3_PUBLIC_ENDPOINT", this.endpoint);
    this.bucket = envOr(config, "S3_BUCKET", "cifratrack");
    this.accessKeyId = envOr(config, "S3_ACCESS_KEY_ID", "cifratrack");
    const secretAccessKey = envOr(
      config,
      "S3_SECRET_ACCESS_KEY",
      "cifratrack_secret",
    );

    const region = envOr(config, "S3_REGION", "us-east-1");
    const forcePathStyle =
      (config.get<string>("S3_FORCE_PATH_STYLE") ?? "true") === "true";
    const credentials = {
      accessKeyId: this.accessKeyId,
      secretAccessKey,
    };

    // MinIO + browser PUT: disable flexible checksums (CRC32 query params break uploads).
    const clientOpts = {
      region,
      forcePathStyle,
      credentials,
      requestChecksumCalculation: "WHEN_REQUIRED" as const,
      responseChecksumValidation: "WHEN_REQUIRED" as const,
    };

    this.client = new S3Client({
      ...clientOpts,
      endpoint: this.endpoint,
    });

    this.signingClient =
      this.publicEndpoint === this.endpoint
        ? this.client
        : new S3Client({
            ...clientOpts,
            endpoint: this.publicEndpoint,
          });

    this.logger.log(
      `S3 ready endpoint=${this.endpoint} public=${this.publicEndpoint} ` +
        `bucket=${this.bucket} accessKeyId=${this.accessKeyId}`,
    );
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
          `Set MINIO_API_CORS_ALLOW_ORIGIN=* (or your front origins). ` +
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

    const uploadUrl = await getSignedUrl(this.signingClient, command, {
      expiresIn,
      signableHeaders: new Set(["content-type"]),
    });

    this.assertPresignedPutUrl(uploadUrl, contentType);

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

  /**
   * URL for the browser. Default = same-origin API proxy (no MinIO CORS / no 127.0.0.1).
   * Set STORAGE_BROWSER_MODE=presigned to return direct S3/MinIO signed URLs.
   */
  async getBrowserObjectUrl(params: {
    key: string;
    expiresInSeconds?: number;
  }) {
    const mode = (
      this.config.get<string>("STORAGE_BROWSER_MODE") ?? "proxy"
    ).toLowerCase();
    if (mode === "presigned") {
      return this.createPresignedGetUrl(params);
    }
    return {
      url: `/v1/storage/objects?key=${encodeURIComponent(params.key)}`,
      expiresAt: new Date(
        Date.now() + (params.expiresInSeconds ?? 3600) * 1000,
      ).toISOString(),
    };
  }

  /** Server-side read via internal S3_ENDPOINT (never use public/presigned host). */
  async getObjectBuffer(key: string): Promise<{
    body: Buffer;
    contentType: string;
  }> {
    try {
      const out = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!out.Body) throw new NotFoundException(`Object not found: ${key}`);
      const bytes = await out.Body.transformToByteArray();
      return {
        body: Buffer.from(bytes),
        contentType: out.ContentType ?? "application/octet-stream",
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.warn(`getObjectBuffer failed for ${key}: ${String(error)}`);
      throw new NotFoundException(`Object not found: ${key}`);
    }
  }

  async getObjectJson<T = unknown>(key: string): Promise<T> {
    const { body } = await this.getObjectBuffer(key);
    return JSON.parse(body.toString("utf8")) as T;
  }

  async getObjectStream(key: string): Promise<{
    body: Readable;
    contentType: string;
    contentLength?: number;
  }> {
    try {
      const out = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!out.Body) throw new NotFoundException(`Object not found: ${key}`);
      return {
        body: out.Body as Readable,
        contentType: out.ContentType ?? "application/octet-stream",
        contentLength:
          typeof out.ContentLength === "number" ? out.ContentLength : undefined,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.warn(`getObjectStream failed for ${key}: ${String(error)}`);
      throw new NotFoundException(`Object not found: ${key}`);
    }
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

  assertSafeObjectKey(key: string) {
    if (
      !key ||
      key.includes("..") ||
      key.startsWith("/") ||
      !/^(audio|sync|covers)\//.test(key)
    ) {
      return false;
    }
    return true;
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

  private assertPresignedPutUrl(uploadUrl: string, contentType: string) {
    if (!contentType) {
      throw new Error("Presigned PUT requires a non-empty Content-Type");
    }

    try {
      const url = new URL(uploadUrl);
      const credential = url.searchParams.get("X-Amz-Credential") ?? "";
      const accessKey = decodeURIComponent(credential).split("/")[0] ?? "";
      if (!accessKey) {
        throw new Error(
          "Presigned URL missing AccessKeyId in X-Amz-Credential — check S3_ACCESS_KEY_ID",
        );
      }
      if (url.searchParams.has("x-amz-checksum-crc32")) {
        this.logger.warn(
          "Presigned URL still includes checksum params; MinIO browser PUT may fail",
        );
      }
      const signedHeaders = url.searchParams.get("X-Amz-SignedHeaders");
      if (!signedHeaders?.split(";").includes("content-type")) {
        this.logger.warn(
          `Presigned PUT missing content-type in SignedHeaders (got: ${signedHeaders})`,
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("AccessKeyId")) {
        throw error;
      }
      this.logger.warn(`Could not validate presigned PUT URL: ${String(error)}`);
    }
  }
}
