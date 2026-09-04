"""
NER-SHIELD: Incident Reporting Pydantic Schemas
Defines validation and serialization models for ground-truth hazard reports.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import IncidentType, IncidentSeverity


class IncidentBase(BaseModel):
    corridor_id: Optional[str] = Field(
        None,
        example="r2",
        description="Associated corridor ID if incident occurs directly on an arterial highway",
    )
    incident_type: IncidentType = Field(
        ...,
        example=IncidentType.LANDSLIDE,
        description="Type of hazard obstruction encountered",
    )
    severity: IncidentSeverity = Field(
        default=IncidentSeverity.HIGH,
        example=IncidentSeverity.HIGH,
        description="Severity classification",
    )
    description: Optional[str] = Field(
        None,
        example="Major mudslide near Sonapur Tunnel portal blocking both lanes",
        description="Field notes or damage observation",
    )
    lat: float = Field(..., ge=-90.0, le=90.0, example=25.1240, description="Latitude")
    lon: float = Field(..., ge=-180.0, le=180.0, example=92.3610, description="Longitude")
    is_blocking: bool = Field(
        default=True,
        description="Whether this incident severs vehicle movement and requires routing bypass",
    )
    reported_by: Optional[str] = Field(
        default="Border Patrol / Field Officer",
        description="Reporting agent or system source",
    )
    synced_from_offline: bool = Field(
        default=False,
        description="Whether this report was queued locally during network outage",
    )


class IncidentCreate(IncidentBase):
    pass


class IncidentResponse(IncidentBase):
    id: int
    reported_at: datetime

    model_config = ConfigDict(from_attributes=True)