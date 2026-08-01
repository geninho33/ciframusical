# CifraTrack Audio Worker

Serviço Python (FastAPI) para análise de áudio — BPM, tom, acordes e geração do `CifraSyncDocument`.

## Fase 0

Bootstrap com endpoint `/health`. Librosa/Essentia entram na Fase 4.

## Desenvolvimento

```bash
cd services/audio-worker
python -m venv .venv
# Windows
.venv\Scripts\activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8001
```

Testes:

```bash
pytest
```
