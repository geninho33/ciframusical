# CifraTrack Audio Worker

Serviço Python (FastAPI) para análise de áudio — BPM, tom, acordes e geração do `CifraSyncDocument`.

## Fase 4

- `POST /analyze` — baixa MP3 do MinIO/S3, analisa e callback na API (`/internal/jobs/...`)
- Engine preferencial: **librosa** (`pip install -e ".[analysis]"`)
- Fallback determinístico se librosa não estiver disponível (Python 3.14 / ambientes sem wheels)

## Desenvolvimento

```bash
cd services/audio-worker
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
# opcional (recomendado em Python 3.11/3.12):
pip install -e ".[analysis]"

set INTERNAL_API_TOKEN=dev-internal-token
uvicorn app.main:app --reload --port 8001
```

## Testes

```bash
pytest
```
