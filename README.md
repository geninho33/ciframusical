# CifraTrack

Plataforma web interativa para músicos estudarem, praticarem e tocarem junto com faixas de áudio — **Backing Track cifrado**, **Play-Along** em tempo real e **conversão MP3 → cifra sincronizada**.

## Documentação

A especificação completa de software (Spec-Driven Development) está em:

📄 **[docs/SPEC.md](docs/SPEC.md)** — Spec Document oficial (visão, arquitetura, dados, APIs, formatos, UI e roadmap)

Arquivos auxiliares:

- [`docs/schema.sql`](docs/schema.sql) — Schema SQL inicial (PostgreSQL)
- [`docs/sync-format.schema.json`](docs/sync-format.schema.json) — JSON Schema do formato de sincronização de cifras

## Stack (resumo)

| Camada | Tecnologia |
|--------|------------|
| Frontend | React + TypeScript + Vite + Zustand + Tone.js / Web Audio API |
| Backend API | NestJS (Node.js) + JWT / OAuth2 |
| Workers de áudio | Python (FastAPI) + Librosa / Essentia + Celery/RQ |
| Banco | PostgreSQL + Redis |
| Storage | S3-compatible (MinIO em dev / AWS S3 em prod) |

## Status

Fase 0 — Especificação (SDD). Implementação conforme o plano em `docs/SPEC.md`.

## Licença

Proprietário — todos os direitos reservados (definir antes do lançamento público).
