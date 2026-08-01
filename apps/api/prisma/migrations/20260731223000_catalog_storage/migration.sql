CREATE TYPE "TrackStatus" AS ENUM ('draft', 'processing', 'needs_review', 'pending_approval', 'published', 'rejected', 'archived');
CREATE TYPE "DifficultyLevel" AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TYPE "MediaKind" AS ENUM ('source_audio', 'preview_audio', 'waveform_peaks', 'cover_image');
CREATE TYPE "MediaUploadStatus" AS ENUM ('pending', 'completed', 'aborted');

CREATE TABLE "artists" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "artists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "genres" (
    "id" SMALLSERIAL NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    CONSTRAINT "genres_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "styles" (
    "id" SMALLSERIAL NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    CONSTRAINT "styles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tracks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "creator_id" UUID NOT NULL,
    "artist_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(220) NOT NULL,
    "original_key" VARCHAR(8),
    "bpm" INTEGER,
    "time_signature" VARCHAR(8) NOT NULL DEFAULT '4/4',
    "difficulty" "DifficultyLevel" NOT NULL DEFAULT 'intermediate',
    "status" "TrackStatus" NOT NULL DEFAULT 'draft',
    "duration_ms" INTEGER,
    "lyrics_plain" TEXT,
    "cover_storage_key" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "tracks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "track_genres" (
    "track_id" UUID NOT NULL,
    "genre_id" SMALLINT NOT NULL,
    CONSTRAINT "track_genres_pkey" PRIMARY KEY ("track_id","genre_id")
);

CREATE TABLE "track_styles" (
    "track_id" UUID NOT NULL,
    "style_id" SMALLINT NOT NULL,
    CONSTRAINT "track_styles_pkey" PRIMARY KEY ("track_id","style_id")
);

CREATE TABLE "favorites" (
    "user_id" UUID NOT NULL,
    "track_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "favorites_pkey" PRIMARY KEY ("user_id","track_id")
);

CREATE TABLE "media_files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "track_id" UUID NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" VARCHAR(128) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "checksum_sha256" CHAR(64),
    "upload_status" "MediaUploadStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    CONSTRAINT "media_files_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "artists_slug_key" ON "artists"("slug");
CREATE UNIQUE INDEX "genres_slug_key" ON "genres"("slug");
CREATE UNIQUE INDEX "styles_slug_key" ON "styles"("slug");
CREATE UNIQUE INDEX "tracks_slug_key" ON "tracks"("slug");
CREATE UNIQUE INDEX "media_files_storage_key_key" ON "media_files"("storage_key");

CREATE INDEX "tracks_status_idx" ON "tracks"("status");
CREATE INDEX "tracks_bpm_idx" ON "tracks"("bpm");
CREATE INDEX "tracks_original_key_idx" ON "tracks"("original_key");
CREATE INDEX "tracks_creator_id_idx" ON "tracks"("creator_id");
CREATE INDEX "media_files_track_id_idx" ON "media_files"("track_id");

ALTER TABLE "tracks" ADD CONSTRAINT "tracks_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "track_genres" ADD CONSTRAINT "track_genres_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "track_genres" ADD CONSTRAINT "track_genres_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "track_styles" ADD CONSTRAINT "track_styles_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "track_styles" ADD CONSTRAINT "track_styles_style_id_fkey" FOREIGN KEY ("style_id") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
