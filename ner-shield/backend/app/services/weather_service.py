"""
NER-SHIELD: Real-Time Meteorological & Soil Telemetry Service
Asynchronously fetches precipitation and root-zone soil saturation from Open-Meteo API.
"""

from typing import Dict, Any, List
import httpx

from app.core.config import settings


class WeatherService:
    """
    Manages live atmospheric queries for corridor waypoints and chokepoints.
    """

    def __init__(self):
        self.base_url = settings.OPEN_METEO_BASE_URL
        self.client_headers = {
            "User-Agent": "NERSHIELD-Logistics-Platform/1.0",
            "Accept": "application/json",
        }

    async def get_point_weather(self, lat: float, lon: float) -> Dict[str, Any]:
        """
        Queries Open-Meteo for 24-hour cumulative precipitation and soil saturation.
        """
        params = {
            "latitude": round(lat, 4),
            "longitude": round(lon, 4),
            "hourly": "precipitation,rain,soil_moisture_0_to_7cm",
            "forecast_days": 2,
            "timezone": "Asia/Kolkata",
        }

        try:
            async with httpx.AsyncClient(
                timeout=10.0, headers=self.client_headers
            ) as client:
                response = await client.get(self.base_url, params=params)
                response.raise_for_status()
                data = response.json()

                hourly = data.get("hourly", {})
                precipitation_records = hourly.get("precipitation", [0.0])
                soil_records = hourly.get("soil_moisture_0_to_7cm", [0.35])

                # 24-hour cumulative rainfall sum (mm)
                rainfall_24h = float(sum(precipitation_records[:24]))

                # Latest root-zone volumetric soil moisture converted to percentage (0 - 100%)
                latest_soil = (
                    float(soil_records[0]) if soil_records else 0.35
                )
                soil_moisture_pct = round(min(max(latest_soil * 100.0, 5.0), 100.0), 2)

                return {
                    "rainfall_24h_mm": round(rainfall_24h, 2),
                    "soil_moisture_pct": soil_moisture_pct,
                    "is_live": True,
                    "latitude": lat,
                    "longitude": lon,
                }

        except Exception as e:
            # Conservative baseline fallback if network is unreachable
            return {
                "rainfall_24h_mm": 18.5,
                "soil_moisture_pct": 42.0,
                "is_live": False,
                "error": str(e),
                "latitude": lat,
                "longitude": lon,
            }

    async def get_corridor_weather(
        self, coordinates: List[List[float]]
    ) -> Dict[str, Any]:
        """
        Samples weather along the corridor midpoint geometry.
        """
        if not coordinates:
            return await self.get_point_weather(25.5788, 91.8933)

        mid_idx = len(coordinates) // 2
        mid_lat, mid_lon = coordinates[mid_idx][0], coordinates[mid_idx][1]
        return await self.get_point_weather(mid_lat, mid_lon)


weather_service = WeatherService()