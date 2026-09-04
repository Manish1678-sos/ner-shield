"""
NER-SHIELD: Route Planning Pydantic Schemas
Defines request payloads and response structures for risk-aware routing and bypasses.
"""

from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import CargoPriority


class RouteRequest(BaseModel):
    origin: str = Field(..., example="guwahati", description="Origin hub ID")
    destination: str = Field(..., example="silchar", description="Destination hub ID")
    cargo_priority: CargoPriority = Field(
        default=CargoPriority.P1_CRITICAL_MED,
        description="Cargo criticality tier influencing risk tolerance",
    )
    avoid_blocked: bool = Field(
        default=True,
        description="Strictly bypass corridors marked as blocked by incidents",
    )


class RouteStep(BaseModel):
    corridor_id: str
    name: str
    highway: str
    source: str
    target: str
    distance_km: float
    time_hours: float
    risk_score: float
    is_blocked: bool

    model_config = ConfigDict(from_attributes=True)


class RouteResponse(BaseModel):
    origin: str
    destination: str
    total_distance_km: float
    total_time_hours: float
    average_risk: float
    is_bypass: bool = Field(
        default=False,
        description="Flag indicating if route diverts around a severed primary corridor",
    )
    path_hubs: List[str] = Field(
        ..., description="Ordered sequence of logistics hub IDs visited"
    )
    corridors_used: List[RouteStep] = Field(
        ..., description="Detailed breakdown of highway links traversed"
    )
    geometry: List[List[float]] = Field(
        ..., description="Continuous [lat, lon] polyline for rendering on the map"
    )
    status: str = Field(
        default="OPTIMAL",
        description="Route status: OPTIMAL, BYPASS_ACTIVE, or UNREACHABLE",
    )

    model_config = ConfigDict(from_attributes=True)