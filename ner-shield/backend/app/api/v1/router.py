"""
NER-SHIELD: API v1 Central Router Aggregator
Combines sub-routers for corridors, pathfinding, and field incident reporting.
"""

from fastapi import APIRouter

from app.api.v1.corridors import router as corridors_router
from app.api.v1.routing import router as routing_router
from app.api.v1.incidents import router as incidents_router

api_router = APIRouter()

# Mount MVP core functional modules
api_router.include_router(corridors_router)
api_router.include_router(routing_router)
api_router.include_router(incidents_router)