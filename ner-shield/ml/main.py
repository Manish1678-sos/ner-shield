from pathlib import Path
import pickle
from fastapi import FastAPI
from pydantic import BaseModel, Field

MODEL_PATH = Path(__file__).parent / 'risk_model.pkl'
try:
    with open(MODEL_PATH, 'rb') as file:
        model = pickle.load(file)
except (EOFError, pickle.UnpicklingError, ValueError):
    import train_model
    with open(MODEL_PATH, 'rb') as file:
        model = pickle.load(file)

app = FastAPI(title='NER-SHIELD Risk Engine')

class RiskInput(BaseModel):
    rainfall_24h: float = Field(ge=0)
    soil_moisture: float = Field(ge=0, le=100)
    slope_angle: float = Field(ge=0)
    elevation: float = Field(ge=0)
    road_condition: float = Field(ge=0, le=1)

def classify(score: float) -> str:
    if score <= .30: return 'SAFE'
    if score <= .60: return 'MODERATE'
    if score <= .80: return 'HIGH RISK'
    return 'BLOCKED'

@app.get('/health')
def health(): return {'status': 'ok', 'service': 'risk-engine'}

@app.post('/predict')
def predict(payload: RiskInput):
    values = [[payload.rainfall_24h, payload.soil_moisture, payload.slope_angle, payload.elevation, payload.road_condition]]
    score = round(float(model.predict(values)[0]), 2)
    return {'riskScore': score, 'classification': classify(score)}
