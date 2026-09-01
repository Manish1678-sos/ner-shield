from pathlib import Path
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
import pickle

rng = np.random.default_rng(42)
X = rng.uniform([0, 0, 0, 0, 0], [300, 100, 45, 2500, 1], size=(500, 5))
y = np.clip(0.0025 * X[:, 0] + 0.004 * X[:, 1] + 0.012 * X[:, 2] + 0.00012 * X[:, 3] + 0.18 * X[:, 4] + rng.normal(0, .05, 500), 0, 1)
model = Pipeline([('scale', StandardScaler()), ('forest', RandomForestRegressor(n_estimators=120, random_state=42))])
model.fit(X, y)
with open(Path(__file__).parent / 'risk_model.pkl', 'wb') as file:
    pickle.dump(model, file)
print('risk_model.pkl trained')
