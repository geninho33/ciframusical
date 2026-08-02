# CORS no MinIO (community)

No MinIO **open-source**, CORS **não** é configurado por bucket (`mc cors set` / `PutBucketCors` → "not implemented").

Use a variável de ambiente do servidor:

```env
MINIO_API_CORS_ALLOW_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
```

Já está no `docker-compose.yml` do monorepo. Após alterar, recrie o container:

```bash
docker compose up -d --force-recreate minio
```

Para AWS S3 real, use CORS no bucket (a API aplica via `PutBucketCors` no boot quando suportado).
