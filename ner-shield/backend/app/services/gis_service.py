"""
NER-SHIELD: Spatial Processing & Geodetic Computation Engine
Provides great-circle distance math, polyline interpolation, and
incident-to-corridor topological snapping across NER coordinates.
"""

import math
from typing import List, Tuple, Dict, Any, Optional
from shapely.geometry import LineString, Point


class GISService:
    """
    Manages vector geometry computations and coordinate snapping.
    """

    EARTH_RADIUS_KM = 6371.0

    @classmethod
    def haversine_km(cls, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculates great-circle distance in kilometers between two coordinates.
        """
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)

        a = (
            math.sin(dphi / 2.0) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
        )
        return 2.0 * cls.EARTH_RADIUS_KM * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    @classmethod
    def calculate_polyline_distance_km(cls, coordinates: List[List[float]]) -> float:
        """
        Calculates cumulative road distance across sequential [lat, lon] waypoints.
        """
        if not coordinates or len(coordinates) < 2:
            return 0.0

        total_km = 0.0
        for i in range(len(coordinates) - 1):
            total_km += cls.haversine_km(
                coordinates[i][0],
                coordinates[i][1],
                coordinates[i + 1][0],
                coordinates[i + 1][1],
            )
        return round(total_km, 2)

    @classmethod
    def snap_incident_to_corridor(
        cls,
        incident_lat: float,
        incident_lon: float,
        corridors: List[Dict[str, Any]],
        max_snap_radius_km: float = 35.0,
    ) -> Optional[str]:
        """
        Identifies which arterial corridor an incident occurred on by calculating
        minimum orthogonal distance from the point to each highway LineString.
        Returns the corridor_id (e.g. 'r2') or None if outside threshold.
        """
        incident_point = Point(incident_lon, incident_lat)
        closest_corridor_id = None
        min_distance_km = float("inf")

        for corridor in corridors:
            coords = corridor.get("coordinates", [])
            if len(coords) < 2:
                continue

            # Convert [lat, lon] list to Shapely [lon, lat] LineString
            line_coords = [(pt[1], pt[0]) for pt in coords]
            line = LineString(line_coords)

            # Minimum distance in coordinate degrees converted to approximate km
            dist_degrees = incident_point.distance(line)
            dist_km = dist_degrees * 111.0

            if dist_km < min_distance_km:
                min_distance_km = dist_km
                closest_corridor_id = corridor.get("id")

        if min_distance_km <= max_snap_radius_km:
            return closest_corridor_id

        return None


gis_service = GISService()