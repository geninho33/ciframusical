from __future__ import annotations

import os
import tempfile
from typing import Any

import boto3
import httpx
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from app.analyze import analyze_available, analyze_file

app = FastAPI(
    title="CifraTrack Audio Worker",
    version="0.4.0",
    description="Analisa áudio e gera CifraSyncDocument (Fase 4).",
)

INTERNAL_TOKEN = os.getenv("INTERNAL_API_TOKEN", "dev-internal-token")


class S3Config(BaseModel):
    endpoint: str
    accessKeyId: str
    secretAccessKey: str
    bucket: str
    region: str = "us-east-1"


class AnalyzeRequest(BaseModel):
    jobId: str
    trackId: str
    mediaStorageKey: str
    title: str
    artist: str
    callbackBaseUrl: str
    internalToken: str
    s3: S3Config


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    phase: int
    analysis: dict[str, Any]


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="cifratrack-audio-worker",
        version="0.4.0",
        phase=4,
        analysis=analyze_available(),
    )


def _assert_token(token: str | None) -> None:
    if not token or token != INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid internal token")


def _s3_client(cfg: S3Config):
    return boto3.client(
        "s3",
        endpoint_url=cfg.endpoint,
        aws_access_key_id=cfg.accessKeyId,
        aws_secret_access_key=cfg.secretAccessKey,
        region_name=cfg.region,
    )


async def _callback(base: str, path: str, token: str, payload: dict[str, Any]) -> None:
    async with httpx.AsyncClient(timeout=60.0) as client:
        res = await client.post(
            f"{base.rstrip('/')}/{path.lstrip('/')}",
            headers={"X-Internal-Token": token, "Content-Type": "application/json"},
            json=payload,
        )
        res.raise_for_status()


@app.post("/analyze")
async def analyze(
    body: AnalyzeRequest,
    x_internal_token: str | None = Header(default=None),
) -> dict[str, Any]:
    _assert_token(x_internal_token or body.internalToken)

    try:
        await _callback(
            body.callbackBaseUrl,
            f"internal/jobs/{body.jobId}/progress",
            body.internalToken,
            {"progress": 15, "stage": "normalize"},
        )

        client = _s3_client(body.s3)
        suffix = os.path.splitext(body.mediaStorageKey)[1] or ".mp3"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp_path = tmp.name
        try:
            client.download_file(body.s3.bucket, body.mediaStorageKey, tmp_path)

            await _callback(
                body.callbackBaseUrl,
                f"internal/jobs/{body.jobId}/progress",
                body.internalToken,
                {"progress": 40, "stage": "beat_track"},
            )

            result = analyze_file(tmp_path, body.title, body.artist)

            await _callback(
                body.callbackBaseUrl,
                f"internal/jobs/{body.jobId}/progress",
                body.internalToken,
                {"progress": 75, "stage": "chord_estimation"},
            )

            await _callback(
                body.callbackBaseUrl,
                f"internal/jobs/{body.jobId}/complete",
                body.internalToken,
                result,
            )
            return {"ok": True, "jobId": body.jobId, "engine": result["syncDocument"]["meta"]["generator"]}
        finally:
            try:
                os.remove(tmp_path)
            except OSError:
                pass
    except Exception as exc:  # noqa: BLE001
        try:
            await _callback(
                body.callbackBaseUrl,
                f"internal/jobs/{body.jobId}/fail",
                body.internalToken,
                {"message": "analyze_failed", "detail": str(exc)[:500]},
            )
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(exc)) from exc
