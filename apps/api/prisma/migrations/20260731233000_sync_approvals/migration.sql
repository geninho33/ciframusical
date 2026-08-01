CREATE TYPE "ApprovalDecision" AS ENUM ('approved', 'rejected', 'changes_requested');

CREATE TABLE "sync_approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sync_version_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sync_approvals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sync_approvals_sync_version_id_idx" ON "sync_approvals"("sync_version_id");

ALTER TABLE "sync_approvals" ADD CONSTRAINT "sync_approvals_sync_version_id_fkey" FOREIGN KEY ("sync_version_id") REFERENCES "sync_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sync_approvals" ADD CONSTRAINT "sync_approvals_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
