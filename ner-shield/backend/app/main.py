"""
NER-SHIELD: AI-Powered Logistics & Accessibility Intelligence Platform
FastAPI & Socket.IO ASGI Root Entry Point (MDoNER / SIH 2026)
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio

from app import __title__, __version__, __description__
from app.core.config import settings
from app.db.session import engine, Base
from app.db.models import CorridorModel, IncidentModel, VehicleModel
from app.api.v1.router import api_router

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

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

fastapi_app.include_router(api_router, prefix="/api/v1")
fastapi_app.include_router(api_router, prefix="/api")


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