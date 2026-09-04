"""
NER-SHIELD: Regional Constants, Geodetic Anchor Points & Operational Taxonomies
Defines verified spatial coordinates, risk thresholds, and logistics schemas.
"""

from enum import Enum
from typing import Dict, List, Any


# 1. Geographic Boundaries (All 8 North Eastern States)
NER_BOUNDING_BOX = {
    "min_lon": 88.0,
    "min_lat": 21.5,
    "max_lon": 97.5,
    "max_lat": 29.5,
}

# 2. Critical Disaster Choke Points (Ground Truth Coordinates)
CHOKEPOINTS = {
    "sonapur_tunnel": {
        "name": "Sonapur Tunnel Choke Point",
        "highway": "NH-6",
        "lat": 25.1240,
        "lon": 92.3610,
        "state": "Meghalaya",
        "district": "East Jaintia Hills",
        "vulnerability": "CHRONIC_LANDSLIDE",
        "description": "Primary mountain tunnel connecting Barak Valley, Mizoram, and Tripura.",
    },
    "haflong_bypass": {
        "name": "Haflong Dima Hasao Pass",
        "highway": "NH-27",
        "lat": 25.1711,
        "lon": 93.0189,
        "state": "Assam",
        "district": "Dima Hasao",
        "vulnerability": "HILL_EROSION_MONSOON_FLOOD",
        "description": "Strategic highland bypass route when NH-6 is severed.",
    },
    "pagala_pahar": {
        "name": "Pagala Pahar Choke Point",
        "highway": "NH-29",
        "lat": 25.7922,
        "lon": 93.9214,
        "state": "Nagaland",
        "district": "Chumoukedima",
        "vulnerability": "CHRONIC_ROCKFALL",
        "description": "Mountain gorge along the Dimapur-Kohima arterial corridor.",
    },
    "teesta_bazaar": {
        "name": "Teesta Valley Corridor",
        "highway": "NH-10",
        "lat": 27.0612,
        "lon": 88.4312,
        "state": "Sikkim / WB Border",
        "district": "Kalimpong",
        "vulnerability": "RIVER_FLOODING_GLOF",
        "description": "Sole arterial supply lifeline connecting Sikkim with Siliguri.",
    },
}

# 3. Logistics Hubs Reference Dictionary
HUBS: Dict[str, Dict[str, Any]] = {
    "guwahati": {"id": "guwahati", "name": "Guwahati Logistics Base", "state": "Assam", "lat": 26.1445, "lon": 91.7362, "elevation_m": 55.0},
    "shillong": {"id": "shillong", "name": "Shillong Transit Hub", "state": "Meghalaya", "lat": 25.5788, "lon": 91.8933, "elevation_m": 1525.0},
    "silchar": {"id": "silchar", "name": "Silchar Barak Valley Depot", "state": "Assam", "lat": 24.8333, "lon": 92.7789, "elevation_m": 25.0},
    "dimapur": {"id": "dimapur", "name": "Dimapur Supply Depot", "state": "Nagaland", "lat": 25.9068, "lon": 93.7271, "elevation_m": 145.0},
    "kohima": {"id": "kohima", "name": "Kohima Forward Depot", "state": "Nagaland", "lat": 25.6751, "lon": 94.1086, "elevation_m": 1444.0},
    "imphal": {"id": "imphal", "name": "Imphal Supply Station", "state": "Manipur", "lat": 24.8170, "lon": 93.9368, "elevation_m": 786.0},
    "aizawl": {"id": "aizawl", "name": "Aizawl Logistics Terminal", "state": "Mizoram", "lat": 23.7271, "lon": 92.7176, "elevation_m": 1132.0},
    "agartala": {"id": "agartala", "name": "Agartala Multi-Modal Hub", "state": "Tripura", "lat": 23.8315, "lon": 91.2868, "elevation_m": 18.0},
}

# 4. Arterial Highway Corridors Reference
CORRIDORS: List[Dict[str, Any]] = [
    {"id": "r1", "source": "guwahati", "target": "shillong", "highway": "NH-6", "name": "NH-6 (Guwahati - Shillong)"},
    {"id": "r2", "source": "shillong", "target": "silchar", "highway": "NH-6", "name": "NH-6 (Jowai - Sonapur Tunnel - Silchar)"},
    {"id": "r3", "source": "guwahati", "target": "dimapur", "highway": "NH-27", "name": "NH-27/29 (Assam - Nagaland)"},
    {"id": "r4", "source": "dimapur", "target": "kohima", "highway": "NH-29", "name": "NH-29 (Dimapur - Kohima Pass)"},
    {"id": "r5", "source": "kohima", "target": "imphal", "highway": "NH-2", "name": "NH-2 (Kohima - Mao Gate - Imphal)"},
    {"id": "r6", "source": "silchar", "target": "aizawl", "highway": "NH-306", "name": "NH-306 (Silchar - Aizawl)"},
    {"id": "r7", "source": "silchar", "target": "agartala", "highway": "NH-8", "name": "NH-8 (Silchar - Agartala)"},
    {"id": "r8", "source": "guwahati", "target": "silchar", "highway": "NH-27", "name": "NH-27 Bypass (Lumding - Haflong - Silchar)"},
    {"id": "r9", "source": "silchar", "target": "imphal", "highway": "NH-37", "name": "NH-37 (Silchar - Jiribam - Imphal)"},
]

# 5. Operational Incident Classifications
class IncidentType(str, Enum):
    LANDSLIDE = "LANDSLIDE"
    FLASH_FLOOD = "FLASH_FLOOD"
    BRIDGE_COLLAPSE = "BRIDGE_COLLAPSE"
    ROAD_EROSION = "ROAD_EROSION"
    TREE_FALL_BLOCKAGE = "TREE_FALL_BLOCKAGE"
    SECURITY_CHECKPOST_HALT = "SECURITY_CHECKPOST_HALT"


class IncidentSeverity(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


# 6. Critical Cargo Priority Taxonomies
class CargoPriority(str, Enum):
    P1_CRITICAL_MED = "P1_CRITICAL_MED"        # Insulin, vaccines, oxygen cylinders, plasma
    P2_FOOD_RATIONS = "P2_FOOD_RATIONS"        # Grains, drinking water, baby food
    P3_INFRASTRUCTURE = "P3_INFRASTRUCTURE"    # Bailey bridge parts, road repair gravel, fuel


# 7. Risk Engine Scoring Bands & Graph Penalties
RISK_THRESHOLD_SAFE = 0.35
RISK_THRESHOLD_MODERATE = 0.65
RISK_THRESHOLD_CRITICAL = 0.85

# Dijkstra Graph Penalty Multiplier: cost = base_time * (1 + risk * 2)
DEFAULT_RISK_MULTIPLIER = 2.0
IMPASSABLE_EDGE_COST = 1e9