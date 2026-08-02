# Deploy CifraTrack (3 containers)

| Serviço   | Container         | Porta interna | Porta HOST |
|-----------|-------------------|---------------|------------|
| Frontend  | `cifratrack-web`  | 80 (Nginx)    | **8088**   |
| Backend   | `cifratrack-api`  | 3000          | **3200**   |
| PostgreSQL| `cifratrack-db`   | 5432          | **5434**   |

Portas evitadas (já em uso na VPS): `3000–3002`, `3100–3102`, `3306–3307`, `5432–5433`, `8001`, `8081`.

O Nginx do front faz proxy de `/v1/*` → `api:3000`, então o browser só precisa da porta **8088**.

## Uso rápido

```bash
cd deploy
cp .env.example .env
# edite senhas, JWT e API_CORS_ORIGIN
chmod +x deploy.sh
./deploy.sh up
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

- `RUN_SEED=true` no primeiro boot cria o admin; depois mude para `false`.
- Redis/MinIO/worker **não** estão neste compose de 3 serviços. Upload/analyze precisam de S3/Redis externos nas variáveis opcionais do `.env`.
