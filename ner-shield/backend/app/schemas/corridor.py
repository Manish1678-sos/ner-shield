"""
NER-SHIELD: Corridor Pydantic Schemas
Defines validation and serialization schemas for arterial highway segments.
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class CorridorBase(BaseModel):
    name: str = Field(..., description="Corridor display name (e.g., NH-6 Sonapur Tunnel)")
    highway: str = Field(..., description="Official National Highway code (e.g., NH-6)")
    source: str = Field(..., description="Origin transit hub ID")
    target: str = Field(..., description="Destination transit hub ID")
    distance_km: float = Field(..., ge=0.0, description="Total route length in kilometers")
    base_time_hours: float = Field(..., ge=0.0, description="Unimpeded traversal duration in hours")
    slope_deg: float = Field(..., ge=0.0, le=90.0, description="DEM-derived terrain slope angle in degrees")
    is_bridge: bool = Field(default=False, description="Whether segment spans critical bridge infrastructure")
    surface_condition: float = Field(default=0.2, ge=0.0, le=1.0, description="Erosion condition index")
    coordinates: List[List[float]] = Field(
        ...,
        description="Sequential list of [lat, lon] geodetic points defining the highway alignment",
    )


class CorridorCreate(CorridorBase):
    id: str = Field(..., description="Unique corridor identifier (e.g., r1, r2)")


class CorridorRiskUpdate(BaseModel):
    risk_score: float = Field(..., ge=0.0, le=1.0, description="Continuous ML disruption probability")
    is_blocked: Optional[bool] = Field(None, description="Physical blockage flag")


class CorridorResponse(CorridorBase):
    id: str
    risk_score: float = Field(default=0.0, ge=0.0, le=1.0)
    is_blocked: bool = False
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)