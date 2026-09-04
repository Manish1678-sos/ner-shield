"""
NER-SHIELD: Dynamic Risk-Aware Pathfinding & Bypass Engine
Loads compiled NetworkX highway graph, applies ML hazard penalties,
and calculates live optimal routes and emergency bypass corridors.
"""

from pathlib import Path
from typing import Dict, Any, List, Optional
import pickle
import networkx as nx

from app.core.config import settings
from app.core.constants import HUBS, IMPASSABLE_EDGE_COST, CargoPriority


class RoutingService:
    """
    Graph-based pathfinding service integrating topological road data
    with continuous disruption probabilities and field blockages.
    """

    def __init__(self):
        self.graph_path = Path(settings.GRAPH_PATH)
        self.graph: nx.Graph = nx.Graph()
        self._load_graph()

    def _load_graph(self) -> None:
        """Deserializes NetworkX graph compiled from OpenStreetMap."""
        if self.graph_path.exists():
            try:
                with open(self.graph_path, "rb") as f:
                    self.graph = pickle.load(f)
                print(
                    f"[RoutingService] Graph loaded: {self.graph.number_of_nodes()} hubs, "
                    f"{self.graph.number_of_edges()} corridors from {self.graph_path}"
                )
            except Exception as e:
                print(f"[RoutingService] Graph load failed: {e}. Reinitializing empty.")
                self.graph = nx.Graph()
        else:
            print(f"[RoutingService] Warning: {self.graph_path} not found.")

    def update_edge_state(
        self,
        corridor_id: str,
        risk_score: float,
        is_blocked: bool = False,
    ) -> bool:
        """
        Dynamically updates edge weights based on ML risk output or incident blockages.
        """
        for u, v, data in self.graph.edges(data=True):
            if data.get("id") == corridor_id:
                data["risk_score"] = float(risk_score)
                data["is_blocked"] = bool(is_blocked)

                if is_blocked:
                    data["cost"] = IMPASSABLE_EDGE_COST
                else:
                    base_time = data.get("base_time_hours", 1.0)
                    data["cost"] = round(base_time * (1.0 + (risk_score * 2.0)), 3)
                return True
        return False

    def find_route(
        self,
        origin: str,
        destination: str,
        cargo_priority: CargoPriority = CargoPriority.P1_CRITICAL_MED,
        avoid_blocked: bool = True,
    ) -> Dict[str, Any]:
        """
        Computes risk-weighted optimal path between logistics hubs.
        Returns ordered hubs, traversed corridor links, total ETA, and map geometry.
        """
        origin_clean = origin.strip().lower()
        dest_clean = destination.strip().lower()

        if origin_clean not in self.graph or dest_clean not in self.graph:
            return {"status": "UNREACHABLE", "error": f"Invalid hub endpoints: {origin} -> {destination}"}

        # Build working subgraph
        subgraph = self.graph.copy()
        if avoid_blocked:
            for u, v, data in list(subgraph.edges(data=True)):
                if data.get("is_blocked", False) or data.get("cost", 0) >= IMPASSABLE_EDGE_COST:
                    subgraph.remove_edge(u, v)

        try:
            path = nx.shortest_path(subgraph, source=origin_clean, target=dest_clean, weight="cost")
        except nx.NetworkXNoPath:
            return {
                "origin": origin_clean,
                "destination": dest_clean,
                "status": "UNREACHABLE",
                "message": "All arterial corridors to destination are currently severed.",
                "path_hubs": [],
                "corridors_used": [],
                "geometry": [],
                "total_distance_km": 0.0,
                "total_time_hours": 0.0,
                "average_risk": 1.0,
                "is_bypass": False,
            }

        # Traverse path links and extract telemetry
        corridors_used = []
        geometry = []
        total_dist = 0.0
        total_time = 0.0
        risks = []
        is_bypass = False

        for i in range(len(path) - 1):
            u, v = path[i], path[i + 1]
            edge_data = self.graph.get_edge_data(u, v)
            if not edge_data:
                continue

            dist = edge_data.get("distance_km", 0.0)
            base_time = edge_data.get("base_time_hours", 0.0)
            risk = edge_data.get("risk_score", 0.0)
            coords = edge_data.get("coordinates", [])

            # Flag bypass status if route uses alternate corridor (e.g. NH-27 Bypass)
            if "Bypass" in edge_data.get("name", ""):
                is_bypass = True

            total_dist += dist
            total_time += base_time * (1.0 + (risk * 2.0))
            risks.append(risk)

            corridors_used.append({
                "corridor_id": edge_data.get("id", f"{u}-{v}"),
                "name": edge_data.get("name", f"{u} to {v}"),
                "highway": edge_data.get("highway", "NH"),
                "source": u,
                "target": v,
                "distance_km": dist,
                "time_hours": round(base_time * (1.0 + (risk * 2.0)), 2),
                "risk_score": risk,
                "is_blocked": edge_data.get("is_blocked", False),
            })

            # Append waypoints maintaining continuity
            if not geometry:
                geometry.extend(coords)
            else:
                geometry.extend(coords[1:])

        avg_risk = round(float(sum(risks) / len(risks)), 3) if risks else 0.0

        return {
            "origin": origin_clean,
            "destination": dest_clean,
            "status": "BYPASS_ACTIVE" if is_bypass else "OPTIMAL",
            "is_bypass": is_bypass,
            "total_distance_km": round(total_dist, 2),
            "total_time_hours": round(total_time, 2),
            "average_risk": avg_risk,
            "path_hubs": path,
            "corridors_used": corridors_used,
            "geometry": geometry,
        }


routing_service = RoutingService()