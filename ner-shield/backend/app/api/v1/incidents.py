"""
NER-SHIELD: Field Incident Reporting & Obstruction REST Endpoints
Handles field hazard submissions, geodetic corridor snapping, and live blockage triggers.
Supports dynamic rerouting and ML hazard updates required by the frontend dashboard.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import (
    get_database_session,
    get_gis,
    get_router,
    GISService,
    RoutingService,
)
from app.db.models import IncidentModel, CorridorModel
from app.core.constants import IncidentType, IncidentSeverity
from app.api.v1.routing import compute_primary_and_bypass
from app.schemas.incident import IncidentResponse

router = APIRouter(prefix="/incidents", tags=["Field Incidents"])


class FlexibleIncidentCreate(BaseModel):
    # Standard backend schema attributes
    corridor_id: Optional[str] = None
    incident_type: Optional[str] = None
    severity: Optional[str] = "CRITICAL"
    description: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    is_blocking: Optional[bool] = True
    reported_by: Optional[str] = "Field Officer"
    synced_from_offline: Optional[bool] = False

    # Frontend payload attributes from App.jsx
    type: Optional[str] = None
    coordinates: Optional[List[float]] = None
    online: Optional[bool] = True
    riskInput: Optional[Dict[str, Any]] = None
    origin: Optional[str] = "Guwahati"
    destination: Optional[str] = "Silchar"


@router.get("", response_model=List[IncidentResponse])
async def list_incidents(
    session: AsyncSession = Depends(get_database_session),
):
    """
    Returns all recorded ground-truth field incident reports ordered by recency.
    """
    stmt = select(IncidentModel).order_by(IncidentModel.reported_at.desc())
    result = await session.execute(stmt)
    return list(result.scalars().all())


@router.post("", status_code=status.HTTP_201_CREATED)
async def report_incident(
    payload: FlexibleIncidentCreate,
    session: AsyncSession = Depends(get_database_session),
    gis_service: GISService = Depends(get_gis),
    router_service: RoutingService = Depends(get_router),
):
    """
    Submits a hazard report, blocks the affected corridor, recalculates
    optimal bypass routes across the graph, and returns updated metrics.
    """
    raw_type = (payload.type or payload.incident_type or "LANDSLIDE").upper()
    try:
        incident_type_val = IncidentType(raw_type).value
    except Exception:
        incident_type_val = IncidentType.LANDSLIDE.value

    raw_sev = (payload.severity or "CRITICAL").upper()
    try:
        severity_val = IncidentSeverity(raw_sev).value
    except Exception:
        severity_val = IncidentSeverity.HIGH.value if hasattr(IncidentSeverity, "HIGH") else raw_sev

    lat = payload.lat
    lon = payload.lon

    if payload.coordinates and len(payload.coordinates) >= 2:
        c0, c1 = float(payload.coordinates[0]), float(payload.coordinates[1])
        if c0 > 60.0 and c1 < 45.0:
            lon, lat = c0, c1
        else:
            lat, lon = c0, c1

    if lat is None or lon is None:
        lat, lon = 24.8333, 92.7789

    desc = payload.description or f"{raw_type} reported at [{round(lat, 4)}, {round(lon, 4)}]"

    stmt = select(CorridorModel)
    corridors_res = await session.execute(stmt)
    corridors = list(corridors_res.scalars().all())

    corridor_id = payload.corridor_id
    if not corridor_id and corridors:
        corridor_dicts = [{"id": c.id, "coordinates": c.coordinates} for c in corridors]
        corridor_id = gis_service.snap_incident_to_corridor(
            incident_lat=lat,
            incident_lon=lon,
            corridors=corridor_dicts,
        )

    incident = IncidentModel(
        corridor_id=corridor_id,
        incident_type=incident_type_val,
        severity=severity_val,
        description=desc,
        lat=lat,
        lon=lon,
        is_blocking=payload.is_blocking if payload.is_blocking is not None else True,
        reported_by=payload.reported_by or "Field Officer",
        synced_from_offline=not payload.online if payload.online is not None else payload.synced_from_offline,
    )
    session.add(incident)

    if payload.is_blocking and corridor_id:
        for c in corridors:
            if c.id == corridor_id:
                c.is_blocked = True
                c.risk_score = 1.0
                break

        router_service.update_edge_state(
            corridor_id=corridor_id,
            risk_score=1.0,
            is_blocked=True,
        )

    await session.commit()
    await session.refresh(incident)

    origin = payload.origin or "Guwahati"
    destination = payload.destination or "Silchar"
    new_routes = compute_primary_and_bypass(
        origin=origin,
        destination=destination,
        router_service=router_service,
        metrics_risk=0.88,
    )

    incident_dict = {
        "id": incident.id,
        "corridor_id": incident.corridor_id,
        "incident_type": incident.incident_type,
        "severity": incident.severity,
        "description": incident.description,
        "lat": incident.lat,
        "lon": incident.lon,
        "is_blocking": incident.is_blocking,
        "reported_at": incident.reported_at.isoformat() if incident.reported_at else datetime.utcnow().isoformat(),
        "reported_by": incident.reported_by,
        "synced_from_offline": incident.synced_from_offline,
    }

    return {
        "incident": incident_dict,
        "routes": new_routes,
        "risk": {
            "riskScore": 0.88,
            "status": "CRITICAL_HAZARD",
        },
    }


@router.delete("/{incident_id}", status_code=status.HTTP_204_NO_CONTENT)
async def clear_incident(
    incident_id: int,
    session: AsyncSession = Depends(get_database_session),
    router_service: RoutingService = Depends(get_router),
):
    """
    Resolves an incident and clears the road blockage if no other blocking incidents exist.
    """
    stmt = select(IncidentModel).where(IncidentModel.id == incident_id)
    result = await session.execute(stmt)
    incident = result.scalars().first()

    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident {incident_id} not found",
        )

    corridor_id = incident.corridor_id
    await session.delete(incident)
    await session.commit()

    if corridor_id:
        remaining_stmt = select(IncidentModel).where(
            IncidentModel.corridor_id == corridor_id,
            IncidentModel.is_blocking.is_(True),
        )
        remaining_res = await session.execute(remaining_stmt)
        if not remaining_res.scalars().first():
            router_service.update_edge_state(
                corridor_id=corridor_id,
                risk_score=0.2,
                is_blocked=False,
            )