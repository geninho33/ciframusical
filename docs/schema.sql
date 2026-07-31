-- CifraTrack — PostgreSQL schema v1.0.0
-- Spec reference: docs/SPEC.md §2

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'deleted');
CREATE TYPE track_status AS ENUM (
  'draft',
  'processing',
  'needs_review',
  'pending_approval',
  'published',
  'rejected',
  'archived'
);
CREATE TYPE difficulty_level AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TYPE media_kind AS ENUM (
  'source_audio',
  'preview_audio',
  'waveform_peaks',
  'cover_image'
);
CREATE TYPE sync_source AS ENUM ('auto', 'manual', 'hybrid');
CREATE TYPE sync_status AS ENUM ('draft', 'published', 'superseded');
CREATE TYPE job_type AS ENUM ('analyze_audio', 'regenerate_sync', 'normalize_audio');
CREATE TYPE job_status AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE approval_decision AS ENUM ('approved', 'rejected', 'changes_requested');

-- ---------------------------------------------------------------------------
-- Identity / RBAC
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           CITEXT NOT NULL UNIQUE,
  password_hash   TEXT,
  display_name    VARCHAR(80) NOT NULL,
  avatar_url      TEXT,
  status          user_status NOT NULL DEFAULT 'active',
  oauth_provider  VARCHAR(32),
  oauth_subject   VARCHAR(255),
  email_verified_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  CONSTRAINT users_oauth_unique UNIQUE (oauth_provider, oauth_subject)
);

CREATE TABLE roles (
  id    SMALLSERIAL PRIMARY KEY,
  code  VARCHAR(32) NOT NULL UNIQUE,
  name  VARCHAR(64) NOT NULL
);

INSERT INTO roles (code, name) VALUES
  ('admin', 'Administrador'),
  ('creator', 'Criador/Músico'),
  ('student', 'Estudante');

CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id SMALLINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  CHAR(64) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  CHAR(64) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
CREATE TABLE artists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(160) NOT NULL,
  slug        VARCHAR(180) NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE genres (
  id          SMALLSERIAL PRIMARY KEY,
  slug        VARCHAR(64) NOT NULL UNIQUE,
  name        VARCHAR(80) NOT NULL
);

CREATE TABLE styles (
  id          SMALLSERIAL PRIMARY KEY,
  slug        VARCHAR(64) NOT NULL UNIQUE,
  name        VARCHAR(80) NOT NULL
);

INSERT INTO genres (slug, name) VALUES
  ('rock', 'Rock'),
  ('pop', 'Pop'),
  ('sertanejo', 'Sertanejo'),
  ('mpb', 'MPB'),
  ('gospel', 'Gospel'),
  ('jazz', 'Jazz'),
  ('blues', 'Blues'),
  ('funk', 'Funk');

INSERT INTO styles (slug, name) VALUES
  ('acoustic', 'Acoustic'),
  ('electric', 'Electric'),
  ('playalong', 'Playalong'),
  ('backing_track', 'Backing Track');

CREATE TABLE tracks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id      UUID NOT NULL REFERENCES users(id),
  artist_id       UUID REFERENCES artists(id),
  title           VARCHAR(200) NOT NULL,
  slug            VARCHAR(220) NOT NULL UNIQUE,
  original_key    VARCHAR(8),
  bpm             INTEGER CHECK (bpm IS NULL OR (bpm BETWEEN 40 AND 240)),
  time_signature  VARCHAR(8) NOT NULL DEFAULT '4/4',
  difficulty      difficulty_level NOT NULL DEFAULT 'intermediate',
  status          track_status NOT NULL DEFAULT 'draft',
  duration_ms     INTEGER,
  lyrics_plain    TEXT,
  cover_storage_key TEXT,
  search_vector   tsvector,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at    TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ
);

CREATE TABLE track_genres (
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  genre_id SMALLINT NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (track_id, genre_id)
);

CREATE TABLE track_styles (
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  style_id SMALLINT NOT NULL REFERENCES styles(id) ON DELETE CASCADE,
  PRIMARY KEY (track_id, style_id)
);

CREATE TABLE favorites (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track_id   UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track_id)
);

-- ---------------------------------------------------------------------------
-- Media & Sync
-- ---------------------------------------------------------------------------
CREATE TABLE media_files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id        UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  kind            media_kind NOT NULL,
  storage_key     TEXT NOT NULL UNIQUE,
  mime_type       VARCHAR(128) NOT NULL,
  size_bytes      BIGINT NOT NULL CHECK (size_bytes >= 0),
  checksum_sha256 CHAR(64),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sync_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id        UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL CHECK (version > 0),
  storage_key     TEXT NOT NULL UNIQUE,
  source          sync_source NOT NULL DEFAULT 'auto',
  status          sync_status NOT NULL DEFAULT 'draft',
  is_current      BOOLEAN NOT NULL DEFAULT FALSE,
  checksum_sha256 CHAR(64),
  format_version  VARCHAR(16) NOT NULL DEFAULT '1.0.0',
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (track_id, version)
);

-- Apenas uma versão current por track (parcial)
CREATE UNIQUE INDEX sync_versions_one_current_per_track
  ON sync_versions (track_id)
  WHERE is_current = TRUE;

CREATE TABLE sync_approvals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_version_id UUID NOT NULL REFERENCES sync_versions(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id),
  decision    approval_decision NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE processing_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id      UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  requested_by  UUID NOT NULL REFERENCES users(id),
  job_type      job_type NOT NULL,
  status        job_status NOT NULL DEFAULT 'queued',
  progress      INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  stage         VARCHAR(64),
  result        JSONB,
  error         JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX idx_tracks_status ON tracks(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tracks_bpm ON tracks(bpm) WHERE deleted_at IS NULL;
CREATE INDEX idx_tracks_key ON tracks(original_key) WHERE deleted_at IS NULL;
CREATE INDEX idx_tracks_creator ON tracks(creator_id);
CREATE INDEX idx_tracks_search ON tracks USING GIN (search_vector);
CREATE INDEX idx_jobs_track ON processing_jobs(track_id, created_at DESC);
CREATE INDEX idx_jobs_status ON processing_jobs(status) WHERE status IN ('queued', 'running');
CREATE INDEX idx_media_track ON media_files(track_id);

-- Trigger simples para search_vector (título)
CREATE OR REPLACE FUNCTION tracks_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('portuguese', coalesce(NEW.title, ''));
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tracks_search
  BEFORE INSERT OR UPDATE OF title ON tracks
  FOR EACH ROW EXECUTE FUNCTION tracks_search_vector_update();
