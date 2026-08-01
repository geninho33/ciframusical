from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(
    title="CifraTrack Audio Worker",
    version="0.1.0",
    description="Bootstrap da Fase 0 — pipeline Librosa/Essentia nas fases seguintes.",
)


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    phase: int


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="cifratrack-audio-worker",
        version="0.1.0",
        phase=0,
    )
