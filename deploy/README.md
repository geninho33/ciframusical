# Deploy CifraTrack

| Serviço    | Container            | Porta interna | Porta HOST |
|------------|----------------------|---------------|------------|
| Frontend   | `cifratrack-web`     | 80 (Nginx)    | **8088**   |
| Backend    | `cifratrack-api`     | 3000          | **3200**   |
| PostgreSQL | `cifratrack-db`      | 5432          | **5434**   |
| MinIO API  | `cifratrack-minio`   | 9000          | **9002**   |
| MinIO UI   | `cifratrack-minio`   | 9001          | **9003**   |
| Redis      | `cifratrack-redis`   | 6379          | (interno)  |
| Worker     | `cifratrack-audio-worker` | 8001     | (interno)  |

Portas evitadas (já em uso na VPS): `3000–3002`, `3100–3102`, `3306–3307`, `5432–5433`, `8001`, `8081`.

Upload padrão: `UPLOAD_MODE=proxy` (browser → API → MinIO), sem CORS no browser para `:9002`.

## Uso rápido

```bash
cd deploy
cp .env.example .env
# edite senhas, JWT e API_CORS_ORIGIN
# em S3_PUBLIC_ENDPOINT use http://SEU_IP:9002 (para playback)
chmod +x deploy.sh
./deploy.sh up          # já faz git pull + build + up
# SKIP_GIT_PULL=true ./deploy.sh up   # se quiser pular o pull
```

## Atalho em `~/.ssh` (VPS)

Instale uma vez (a partir do clone):

```bash
bash deploy/ssh/install-on-vps.sh
```

Depois, de qualquer pasta:

```bash
~/.ssh/cifratrack-deploy.sh up      # git pull + build + up
~/.ssh/cifratrack-deploy.sh pull    # só git pull
~/.ssh/cifratrack-deploy.sh logs
```

O install grava `~/.ssh/cifratrack.env` com `CIFRATRACK_ROOT` apontando para o clone.

Se a API ficar unhealthy:

```bash
docker compose -f docker-compose.yml --env-file .env logs api --tail=200
```

Recriar só o MinIO:

```bash
docker compose -f docker-compose.yml --env-file .env up -d --force-recreate minio minio-init
```

## Estrutura

```text
deploy/
  Dockerfile.api
  Dockerfile.web
  docker-compose.yml
  .env.example
  deploy.sh
  nginx/default.conf
  docker/api-entrypoint.sh
```

## Notas

- Admin: `ENSURE_ADMIN=true` → `admin@cifratrack.local` / `Admin123!` (ou `SEED_ADMIN_*`).
- MinIO community: CORS via `MINIO_API_CORS_ALLOW_ORIGIN` (ver `docker/minio-cors.readme.md`).
- Worker Python: serviço `audio-worker` (`AUDIO_WORKER_URL=http://audio-worker:8001`). Sem ele a análise fica em timeout.
- Diagnóstico: `docker compose --env-file .env logs audio-worker api --tail=100`
- Upload: Nginx `client_max_body_size 120m` (evita HTTP 413).
- Aviso de “senha em página não segura”: o site está em **HTTP**. Para sumir o aviso do browser, coloque HTTPS (domínio + Caddy/Nginx/Certbot na frente da porta 8088).
