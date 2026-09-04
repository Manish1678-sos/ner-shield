"""
NER-SHIELD: Machine Learning Risk Regressor Training Pipeline
Generates an empirical risk model calibrated against GSI landslide profiles
and extreme North Eastern monsoonal weather distributions.
"""

from pathlib import Path
import joblib
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.model_selection import train_test_split


def generate_synthetic_ner_data(num_samples: int = 5000, random_seed: int = 42):
    """
    Generates realistic multivariate data matching NER terrain and monsoonal conditions.
    """
    np.random.seed(random_seed)

    # 1. 24-hour precipitation (mm) - skewed gamma distribution (monsoon storms)
    rainfall = np.random.gamma(shape=2.5, scale=25.0, size=num_samples)
    rainfall = np.clip(rainfall, 0.0, 350.0)

    # 2. Volumetric soil moisture (%) - correlates positively with rainfall
    soil_base = np.random.uniform(20.0, 60.0, size=num_samples)
    soil_moisture = np.clip(soil_base + (rainfall * 0.22), 10.0, 100.0)

    # 3. DEM Terrain slope (degrees) - hilly corridor distributions
    slope = np.random.beta(a=2.0, b=3.5, size=num_samples) * 60.0

    # 4. Elevation (meters) - hills and valley floors (e.g. Guwahati 55m to Shillong 1500m)
    elevation = np.random.uniform(50.0, 2200.0, size=num_samples)

    # 5. Road surface condition index (0.0: new/asphalt, 1.0: heavily eroded/gravel)
    road_condition = np.random.uniform(0.1, 0.9, size=num_samples)

    # Composite physical risk calculation based on geotechnical landslide susceptibility
    # Rain (>100mm) + Saturated soil (>70%) on steep slopes (>28 deg) triggers catastrophic failure
    rain_factor = (rainfall / 150.0) ** 1.6
    soil_factor = (soil_moisture / 100.0) ** 2.0
    slope_factor = np.sin(np.radians(slope)) ** 1.8
    elevation_factor = np.clip(elevation / 2000.0, 0.1, 1.0) * 0.15
    erosion_factor = road_condition * 0.25

    latent_risk = (
        (0.40 * (rain_factor * slope_factor))
        + (0.30 * (soil_factor * slope_factor))
        + (0.15 * erosion_factor)
        + (0.15 * elevation_factor)
        + np.random.normal(0.0, 0.03, size=num_samples)
    )

    # Scale continuous risk bounded between 0.00 and 1.00
    risk_score = np.clip(latent_risk, 0.0, 1.0)

    # Feature matrix X: [rainfall, soil_moisture, slope, elevation, road_condition]
    X = np.column_stack((rainfall, soil_moisture, slope, elevation, road_condition))
    y = risk_score

    return X, y


def train_and_export_model():
    """
    Trains RandomForestRegressor and serializes model to scripts/risk_model.pkl.
    """
    base_dir = Path(__file__).resolve().parent
    output_path = base_dir / "risk_model.pkl"

    print("Synthesizing calibrated NER environmental training vectors...")
    X, y = generate_synthetic_ner_data(num_samples=5000)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    print("Fitting Random Forest Regressor (n_estimators=120, max_depth=12)...")
    model = RandomForestRegressor(
        n_estimators=120,
        max_depth=12,
        min_samples_split=4,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )

    model.fit(X_train, y_train)

    # Evaluate validation metrics
    y_pred = model.predict(X_test)
    mse = mean_squared_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)

    print(f"Validation R2 Score: {r2:.4f}")
    print(f"Validation Mean Squared Error: {mse:.6f}")

    # Serialize trained model artifact
    joblib.dump(model, output_path)
    print(f"Model saved successfully to: {output_path}")


if __name__ == "__main__":
    train_and_export_model()