# CifraTrack

Plataforma web interativa para músicos estudarem, praticarem e tocarem junto com faixas de áudio — **Backing Track cifrado**, **Play-Along** em tempo real e **conversão MP3 → cifra sincronizada**.

## Documentação

- 📄 **[docs/SPEC.md](docs/SPEC.md)** — Spec Document SDD (fonte da verdade)
- [`docs/schema.sql`](docs/schema.sql) — Schema PostgreSQL
- [`docs/sync-format.schema.json`](docs/sync-format.schema.json) — JSON Schema do sync

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | React + TypeScript + Vite + Zustand |
| Backend API | NestJS (Node 22) |
| Audio Worker | Python FastAPI (+ Librosa na Fase 4) |
| Dados | PostgreSQL + Redis + MinIO (S3) |
| Monorepo | pnpm + Turborepo |

## Estrutura

```text
apps/web                 # SPA
apps/api                 # NestJS API
services/audio-worker    # Worker Python
packages/typescript-config
docs/                    # Spec + schema
```

## Pré-requisitos

- Node.js 22+
- pnpm 9 (`npm i -g pnpm`)
- Docker Desktop
- Python 3.11+ (worker)

## Setup local

```bash
# 1) Dependências JS
pnpm install
cp .env.example .env
cp .env apps/api/.env

# 2) Infra (Docker Desktop ligado)
pnpm docker:up
# Postgres do Compose usa a porta host 5433 (evita conflito com Postgres local)

# 3) Banco + seed admin
pnpm db:setup
# admin@cifratrack.local / Admin123!
# demo track: meu-amor-acoustic-playalong

# 4) Apps
pnpm dev:api    # http://localhost:3000/v1/health
pnpm dev:web    # http://localhost:5173
```

## Scripts

| Comando | Descrição |
|---------|-----------|
| `pnpm dev` | Turbo: sobe web + api |
| `pnpm build` | Build de todos os pacotes |
| `pnpm lint` / `typecheck` / `test` | Qualidade |
| `pnpm docker:up` / `docker:down` | Postgres, Redis, MinIO |
| `pnpm db:setup` | Migrate + seed (admin) |

## Status

**Fase 3 — Player Play-Along** implementada. Demo: `/praticar/meu-amor-acoustic-playalong` (fixture de sync + clock Tone.js).

## Licença

Proprietário — todos os direitos reservados (definir antes do lançamento público).
