# NER-SHIELD - MDoNER Logistics Grid

A hackathon-ready emergency logistics command center. **DEMO DATA** is clearly marked in the UI.

## Structure
- `client/`: React + Vite + Tailwind + Leaflet + Framer Motion dashboard
- `server/`: Express/Mongoose API, weighted GIS route engine, JWT auth, Socket.IO
- `ml/`: FastAPI + scikit-learn Random Forest risk service

## Run
1. Copy `server/.env.example` to `server/.env` and adjust MongoDB if available.
2. `npm install` at the root, then `npm run install:all`.
3. Python: `cd ml`, `python -m pip install -r requirements.txt`, `python train_model.py`, then `uvicorn main:app --reload --port 8000`.
4. In another terminal: `npm run dev --prefix server`.
5. In another terminal: `npm run dev --prefix client`, then open `http://localhost:5173`.

The Node API runs in demo mode without MongoDB. Demo logins: `command@nershield.demo` / `demo123` (COMMAND_OFFICER) and `driver@nershield.demo` / `demo123` (FIELD_DRIVER). Auth endpoints are implemented at `/api/auth/register`, `/api/auth/login`, and `/api/auth/me`.

## 60-second demo
1. Point the route from Guwahati to Silchar and calculate the safe route.
2. Click **SIMULATE LANDSLIDE**.
3. Watch rainfall, soil moisture, and risk rise; the incident is broadcast and the road is blocked.
4. The cyan AI bypass appears, cargo changes route, and ETA updates live through Socket.IO.
5. Open **REPORT HAZARD** to show the field reporter and toggle offline mode to queue a report.

Story: AI predicts road risk -> field officer reports landslide -> road becomes blocked -> GIS finds a safe route -> cargo reroutes -> command center updates in real time.
