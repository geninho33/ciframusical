CREATE TYPE "ReportReason" AS ENUM ('copyright', 'inappropriate', 'spam', 'incorrect_sync', 'other');
CREATE TYPE "ReportStatus" AS ENUM ('open', 'reviewing', 'resolved', 'dismissed');

CREATE TABLE "track_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "track_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "details" VARCHAR(1000),
    "status" "ReportStatus" NOT NULL DEFAULT 'open',
    "resolver_id" UUID,
    "resolution" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),
    CONSTRAINT "track_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "track_reports_status_idx" ON "track_reports"("status");
CREATE INDEX "track_reports_track_id_idx" ON "track_reports"("track_id");

ALTER TABLE "track_reports" ADD CONSTRAINT "track_reports_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "track_reports" ADD CONSTRAINT "track_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "track_reports" ADD CONSTRAINT "track_reports_resolver_id_fkey" FOREIGN KEY ("resolver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
