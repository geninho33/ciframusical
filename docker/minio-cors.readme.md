# CORS no MinIO (community)

No MinIO **open-source**, CORS **não** é configurado por bucket (`mc cors set` / `PutBucketCors` → "not implemented").

Use a variável de ambiente do servidor:

```env
MINIO_API_CORS_ALLOW_ORIGIN=*
```

Já está no `docker-compose.yml`. Após alterar:

```bash
docker compose up -d --force-recreate minio
```

## Recomendado no CifraTrack

Por padrão `UPLOAD_MODE=proxy`: o browser envia o MP3 para `PUT /v1/media/uploads/:id/content` e a API grava no MinIO. **Sem CORS no :9000.**

`UPLOAD_MODE=presigned` só faz sentido com AWS S3 (ou MinIO com `MINIO_API_CORS_ALLOW_ORIGIN` correto) e credenciais válidas na URL (`X-Amz-Credential` deve começar com o access key, não com `/`).
