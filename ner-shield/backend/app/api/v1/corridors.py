"""
NER-SHIELD: Arterial Corridors & Logistics Hubs REST Endpoints
Manages corridor geometry queries, hub coordinates, and live risk recalculations.
"""

from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import (
    get_database_session,
    get_weather,
    get_ml,
    get_router,
    WeatherService,
    MLRiskService,
    RoutingService,
)
from app.db.models import CorridorModel
from app.schemas.corridor import CorridorResponse
from app.core.constants import HUBS

router = APIRouter(prefix="/corridors", tags=["Arterial Corridors"])


async def _seed_corridors_from_graph(
    session: AsyncSession, router_service: RoutingService
) -> List[CorridorModel]:
    """
    Seeds database from the OpenStreetMap NetworkX graph if the corridors table is empty.
    """
    corridor_models = []
    for u, v, data in router_service.graph.edges(data=True):
        cid = data.get("id", f"{u}-{v}")
        model = CorridorModel(
            id=cid,
            name=data.get("name", f"{u.title()} - {v.title()}"),
            highway=data.get("highway", "NH"),
            source=u,
            target=v,
            distance_km=data.get("distance_km", 100.0),
            base_time_hours=data.get("base_time_hours", 2.5),
            slope_deg=data.get("slope_deg", 12.0),
            is_bridge=data.get("is_bridge", False),
            surface_condition=data.get("surface_condition", 0.2),
            coordinates=data.get("coordinates", []),
            risk_score=data.get("risk_score", 0.0),
            is_blocked=data.get("is_blocked", False),
        )
        session.add(model)
        corridor_models.append(model)

    await session.commit()
    for m in corridor_models:
        await session.refresh(m)
    return corridor_models


@router.get("", response_model=List[CorridorResponse])
async def list_corridors(
    session: AsyncSession = Depends(get_database_session),
    router_service: RoutingService = Depends(get_router),
):
    """
    Returns all arterial highway corridors across the North Eastern Region.
    Auto-seeds from OpenStreetMap graph if database is fresh.
    """
    stmt = select(CorridorModel)
    result = await session.execute(stmt)
    corridors = list(result.scalars().all())

    if not corridors and router_service.graph.number_of_edges() > 0:
        corridors = await _seed_corridors_from_graph(session, router_service)

    return corridors


@router.get("/hubs", response_model=List[Dict[str, Any]])
async def list_logistics_hubs():
    """
    Returns verified geodetic coordinates and operational data for NER supply hubs.
    Used by frontend map components to render terminal markers.
    """
    return list(HUBS.values())


@router.get("/{corridor_id}", response_model=CorridorResponse)
async def get_corridor(
    corridor_id: str,
    session: AsyncSession = Depends(get_database_session),
):
    """
    Retrieves geometry and risk status for a specific highway corridor segment.
    """
    stmt = select(CorridorModel).where(CorridorModel.id == corridor_id)
    result = await session.execute(stmt)
    corridor = result.scalars().first()

    if not corridor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Corridor '{corridor_id}' not found.",
        )

    return corridor


@router.post("/{corridor_id}/evaluate", response_model=CorridorResponse)
async def evaluate_corridor_risk(
    corridor_id: str,
    session: AsyncSession = Depends(get_database_session),
    weather_service: WeatherService = Depends(get_weather),
    ml_service: MLRiskService = Depends(get_ml),
    router_service: RoutingService = Depends(get_router),
):
    """
    Polls live Open-Meteo weather for corridor coordinates, runs ML hazard inference,
    and updates the dynamic routing graph edge cost.
    """
    stmt = select(CorridorModel).where(CorridorModel.id == corridor_id)
    result = await session.execute(stmt)
    corridor = result.scalars().first()

    if not corridor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Corridor '{corridor_id}' not found.",
        )

    # 1. Fetch live weather telemetry
    weather_data = await weather_service.get_corridor_weather(corridor.coordinates)

    # 2. Run ML disruption inference
    new_risk = ml_service.evaluate_corridor(
        corridor_data={
            "slope_deg": corridor.slope_deg,
            "elevation_m": 800.0,
            "surface_condition": corridor.surface_condition,
        },
        weather_data=weather_data,
    )

    # 3. Update database record
    corridor.risk_score = new_risk
    await session.commit()
    await session.refresh(corridor)

    # 4. Synchronize in-memory NetworkX routing graph
    router_service.update_edge_state(
        corridor_id=corridor.id,
        risk_score=new_risk,
        is_blocked=corridor.is_blocked,
    )

    return corridor