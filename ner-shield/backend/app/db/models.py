"""
NER-SHIELD: Declarative Database Models
Encapsulates arterial corridors, field incidents, and supply fleet telematics.
"""

from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Float,
    Boolean,
    Integer,
    DateTime,
    JSON,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class CorridorModel(Base):
    """
    Arterial highway segments connecting strategic NER logistics terminals.
    Stores geodetic alignments, slope, and live disruption risk states.
    """
    __tablename__ = "corridors"

    id = Column(String(50), primary_key=True, index=True)  # e.g., 'r1', 'r2'
    name = Column(String(150), nullable=False)
    highway = Column(String(50), nullable=False, index=True)  # 'NH-6', 'NH-27'
    source = Column(String(100), nullable=False, index=True)  # 'guwahati'
    target = Column(String(100), nullable=False, index=True)  # 'silchar'
    distance_km = Column(Float, nullable=False)
    base_time_hours = Column(Float, nullable=False)
    slope_deg = Column(Float, nullable=False)
    is_bridge = Column(Boolean, default=False)
    surface_condition = Column(Float, default=0.2)
    coordinates = Column(JSON, nullable=False)  # List of [lat, lon] waypoints
    risk_score = Column(Float, default=0.0)  # Continuous ML hazard output [0.0 - 1.0]
    is_blocked = Column(Boolean, default=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    incidents = relationship("IncidentModel", back_populates="corridor", cascade="all, delete-orphan")


class IncidentModel(Base):
    """
    Ground-truth field reports submitted by officers or simulated offline apps.
    Directly triggers edge blockage and AI dynamic rerouting.
    """
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    corridor_id = Column(String(50), ForeignKey("corridors.id"), nullable=True, index=True)
    incident_type = Column(String(50), nullable=False)  # LANDSLIDE, FLASH_FLOOD, etc.
    severity = Column(String(20), default="HIGH")  # LOW, MODERATE, HIGH, CRITICAL
    description = Column(Text, nullable=True)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    is_blocking = Column(Boolean, default=True)
    reported_by = Column(String(100), default="Border Patrol / Field Officer")
    reported_at = Column(DateTime, default=datetime.utcnow)
    synced_from_offline = Column(Boolean, default=False)

    # Relationships
    corridor = relationship("CorridorModel", back_populates="incidents")


class VehicleModel(Base):
    """
    Critical supply convoy telematics tracking high-priority logistics (P1 Med, P2 Food).
    """
    __tablename__ = "vehicles"

    vehicle_id = Column(String(50), primary_key=True, index=True)  # 'TRK-04'
    vehicle_type = Column(String(50), default="REFRIGERATED_MED_VAN")
    driver_name = Column(String(100), default="Subedar R. Kalita")
    cargo_priority = Column(String(50), default="P1_CRITICAL_MED")
    current_lat = Column(Float, nullable=False)
    current_lon = Column(Float, nullable=False)
    speed_kmh = Column(Float, default=42.0)
    cargo_temp_c = Column(Float, default=4.2)  # For vaccine cold-chain monitoring
    destination = Column(String(100), default="Silchar Barak Valley Depot")
    status = Column(String(50), default="IN_TRANSIT")  # IN_TRANSIT, DELAYED, REROUTED
    last_ping = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)