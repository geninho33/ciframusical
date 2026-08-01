CREATE TYPE "SyncSource" AS ENUM ('auto', 'manual', 'hybrid');
CREATE TYPE "SyncStatus" AS ENUM ('draft', 'published', 'superseded');
CREATE TYPE "JobType" AS ENUM ('analyze_audio', 'regenerate_sync', 'normalize_audio');
CREATE TYPE "JobStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');

CREATE TABLE "sync_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "track_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "source" "SyncSource" NOT NULL DEFAULT 'auto',
    "status" "SyncStatus" NOT NULL DEFAULT 'draft',
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "checksum_sha256" CHAR(64),
    "format_version" VARCHAR(16) NOT NULL DEFAULT '1.0.0',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sync_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "processing_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "track_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "job_type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "stage" VARCHAR(64),
    "result" JSONB,
    "error" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    CONSTRAINT "processing_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sync_versions_storage_key_key" ON "sync_versions"("storage_key");
CREATE UNIQUE INDEX "sync_versions_track_id_version_key" ON "sync_versions"("track_id", "version");
CREATE INDEX "sync_versions_track_id_is_current_idx" ON "sync_versions"("track_id", "is_current");
CREATE INDEX "processing_jobs_track_id_created_at_idx" ON "processing_jobs"("track_id", "created_at");
CREATE INDEX "processing_jobs_status_idx" ON "processing_jobs"("status");

ALTER TABLE "sync_versions" ADD CONSTRAINT "sync_versions_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sync_versions" ADD CONSTRAINT "sync_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
