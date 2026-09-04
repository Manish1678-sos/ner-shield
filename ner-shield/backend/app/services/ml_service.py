"""
NER-SHIELD: Machine Learning Hazard Inference Service
Loads serialized Random Forest model to predict continuous corridor disruption risk
based on real-time atmospheric feeds and static DEM terrain features.
"""

from pathlib import Path
import math
from typing import Optional, Dict, Any
import joblib
import numpy as np

from app.core.config import settings


class MLRiskService:
    """
    Manages runtime loading and inference of the landslide disruption risk model.
    """

    def __init__(self):
        self.model = None
        self.model_path = Path(settings.MODEL_PATH)
        self._load_model()

    def _load_model(self) -> None:
        """Loads trained Random Forest regressor from disk if present."""
        try:
            if self.model_path.exists():
                self.model = joblib.load(self.model_path)
                print(f"[MLService] Loaded risk model from: {self.model_path}")
            else:
                print(
                    f"[MLService] Model file not found at {self.model_path}. "
                    "Operating in heuristic fallback mode."
                )
        except Exception as e:
            print(
                f"[MLService] Warning: Failed to deserialize {self.model_path}: {e}. "
                "Operating in heuristic fallback mode."
            )
            self.model = None

    def predict_risk(
        self,
        rainfall_mm: float,
        soil_moisture_pct: float,
        slope_deg: float,
        elevation_m: float = 800.0,
        road_condition: float = 0.3,
    ) -> float:
        """
        Computes continuous disruption risk score (0.00 to 1.00).
        Uses trained Random Forest if available; otherwise uses calibrated geotechnical equations.
        """
        # Feature vector: [rainfall, soil_moisture, slope, elevation, road_condition]
        features = np.array(
            [[rainfall_mm, soil_moisture_pct, slope_deg, elevation_m, road_condition]],
            dtype=np.float32,
        )

        if self.model is not None:
            try:
                raw_pred = float(self.model.predict(features)[0])
                return round(float(np.clip(raw_pred, 0.0, 1.0)), 4)
            except Exception as e:
                print(f"[MLService] Inference error, falling back to heuristic: {e}")

        # Geotechnical physical fallback calculation
        rain_factor = (rainfall_mm / 150.0) ** 1.6
        soil_factor = (soil_moisture_pct / 100.0) ** 2.0
        slope_factor = math.sin(math.radians(slope_deg)) ** 1.8
        elevation_factor = min(max(elevation_m / 2000.0, 0.1), 1.0) * 0.15
        erosion_factor = road_condition * 0.25

        heuristic_risk = (
            (0.40 * (rain_factor * slope_factor))
            + (0.30 * (soil_factor * slope_factor))
            + (0.15 * erosion_factor)
            + (0.15 * elevation_factor)
        )

        return round(float(np.clip(heuristic_risk, 0.0, 1.0)), 4)

    def evaluate_corridor(
        self,
        corridor_data: Dict[str, Any],
        weather_data: Dict[str, Any],
    ) -> float:
        """
        Helper method combining corridor terrain data with live weather telemetry.
        """
        rainfall = weather_data.get("rainfall_24h_mm", 0.0)
        soil = weather_data.get("soil_moisture_pct", 30.0)
        slope = corridor_data.get("slope_deg", 15.0)
        elevation = corridor_data.get("elevation_m", 750.0)
        condition = corridor_data.get("surface_condition", 0.2)

        return self.predict_risk(
            rainfall_mm=rainfall,
            soil_moisture_pct=soil,
            slope_deg=slope,
            elevation_m=elevation,
            road_condition=condition,
        )


ml_service = MLRiskService()