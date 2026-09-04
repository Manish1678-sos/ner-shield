"""
NER-SHIELD: API Dependency Injection Engine
Exposes reusable database session lifecycles and singleton service dependencies.
"""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.weather_service import weather_service, WeatherService
from app.services.ml_service import ml_service, MLRiskService
from app.services.gis_service import gis_service, GISService
from app.services.routing_service import routing_service, RoutingService


async def get_database_session() -> AsyncGenerator[AsyncSession, None]:
    """Provides an isolated async database session per request."""
    async for session in get_db():
        yield session


def get_weather() -> WeatherService:
    """Returns the weather telemetry service singleton."""
    return weather_service


def get_ml() -> MLRiskService:
    """Returns the ML risk inference engine singleton."""
    return ml_service


def get_gis() -> GISService:
    """Returns the spatial geometry service singleton."""
    return gis_service


def get_router() -> RoutingService:
    """Returns the graph-based routing service singleton."""
    return routing_service