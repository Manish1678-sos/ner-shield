"""
NER-SHIELD: AI-Powered Logistics & Accessibility Intelligence Platform
FastAPI & Socket.IO ASGI Root Entry Point (MDoNER / SIH 2026)
"""

from contextlib import asynccontextmanager
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import socketio

from app import __title__, __version__, __description__
from app.core.config import settings
from app.db.session import engine, Base
from app.db.models import CorridorModel, IncidentModel, VehicleModel
from app.services.ml_service import ml_service
from app.api.v1.router import api_router

# ============================================================================
# Socket.IO Real-time Engine
# ============================================================================

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
)


@sio.event
async def connect(sid, environ, auth=None):
    print(f"[Socket.IO] Client connected: {sid}")


@sio.event
async def disconnect(sid):
    print(f"[Socket.IO] Client disconnected: {sid}")


# ============================================================================
# FastAPI Application & Lifecycle
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print(f"[{settings.APP_NAME}] Database schemas synchronized successfully.")
    yield
    await engine.dispose()
    print(f"[{settings.APP_NAME}] Database connections closed.")


fastapi_app = FastAPI(
    title=__title__,
    version=__version__,
    description=__description__,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Build dynamic allowed origins
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://ner-shield-logistics.netlify.app",
]

env_cors = os.getenv("CORS_ORIGINS", "")
if env_cors:
    if env_cors == "*":
        allowed_origins = ["*"]
    else:
        for origin in env_cors.split(","):
            cleaned = origin.strip()
            if cleaned and cleaned not in allowed_origins:
                allowed_origins.append(cleaned)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*--ner-shield-logistics\.netlify\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

fastapi_app.include_router(api_router, prefix="/api/v1")
fastapi_app.include_router(api_router, prefix="/api")


# Machine Learning Prediction Route
class RiskPredictRequest(BaseModel):
    rainfall_24h: float = Field(default=80.0, ge=0)
    soil_moisture: float = Field(default=50.0, ge=0, le=100)
    slope_angle: float = Field(default=18.0, ge=0)
    elevation: float = Field(default=850.0, ge=0)
    road_condition: float = Field(default=0.8, ge=0, le=1)


@fastapi_app.post("/api/risk/predict", tags=["Risk Engine"])
@fastapi_app.post("/api/v1/risk/predict", tags=["Risk Engine"])
async def predict_risk(payload: RiskPredictRequest):
    try:
        try:
            # Try positional arguments first
            score = ml_service.predict_risk(
                payload.rainfall_24h,
                payload.soil_moisture,
                payload.slope_angle,
                payload.elevation,
                payload.road_condition,
            )
        except TypeError:
            # Fall back to named rainfall_mm argument
            score = ml_service.predict_risk(
                rainfall_mm=payload.rainfall_24h,
                soil_moisture=payload.soil_moisture,
                slope_angle=payload.slope_angle,
                elevation=payload.elevation,
                road_condition=payload.road_condition,
            )
    except Exception as exc:
        print(f"[ML Risk Engine Fallback] {exc}")
        score = round(
            min(
                1.0,
                (
                    payload.rainfall_24h * 0.0025
                    + payload.soil_moisture * 0.004
                    + payload.slope_angle * 0.012
                    + payload.elevation * 0.00012
                    + payload.road_condition * 0.18
                ),
            ),
            2,
        )

    if isinstance(score, dict):
        return score

    val = round(float(score), 2)
    classification = (
        "BLOCKED"
        if val > 0.8
        else "HIGH RISK"
        if val > 0.6
        else "MODERATE"
        if val > 0.3
        else "SAFE"
    )
    return {
        "riskScore": val,
        "risk": val,
        "classification": classification,
    }


@fastapi_app.get("/", tags=["System Telemetry"])
async def root():
    return {
        "platform": settings.APP_NAME,
        "version": __version__,
        "environment": settings.ENVIRONMENT,
        "status": "OPERATIONAL",
        "region": "North Eastern Region (NER, India)",
        "documentation": "/docs",
        "api_v1": "/api/v1",
    }


@fastapi_app.get("/health", tags=["System Telemetry"])
async def health_check():
    return {"status": "healthy"}


app = socketio.ASGIApp(
    socketio_server=sio,
    other_asgi_app=fastapi_app,
    socketio_path="socket.io",
)