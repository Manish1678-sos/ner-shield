"""
NER-SHIELD: Global Application Configuration Engine
Defines environment validation schemas using Pydantic Settings.
"""

from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application Metadata & Server Network
    APP_NAME: str = "NER-SHIELD-Core"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    HOST: str = "127.0.0.1"
    PORT: int = 5000

    # Cross-Origin Resource Sharing (CORS)
    CORS_ORIGINS: Union[str, List[str]] = (
        "http://localhost:5173,http://127.0.0.1:5173"
    )

    @field_validator("CORS_ORIGINS", mode="after")
    @classmethod
    def parse_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    # Storage Engine (Local SQLite default with PostgreSQL/PostGIS production support)
    DATABASE_URL: str = "sqlite+aiosqlite:///./ner_shield.db"

    # Cryptographic Authentication & JWT Security
    JWT_SECRET: str = "super_secret_ner_shield_jwt_key_development_only_2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # Compiled Artifact Filepaths
    MODEL_PATH: str = "scripts/risk_model.pkl"
    GRAPH_PATH: str = "scripts/road_graph.pickle"

    # External Dynamic Telemetry APIs (Keyless)
    OPEN_METEO_BASE_URL: str = "https://api.open-meteo.com/v1/forecast"
    RAINVIEWER_BASE_URL: str = "https://api.rainviewer.com/public/weather-maps.json"


settings = Settings()