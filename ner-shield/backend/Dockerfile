# ==============================================================================
# NER-SHIELD Backend: Multi-Stage Production Container
# ==============================================================================

FROM python:3.11-slim AS base

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=off \
    PIP_DISABLE_PIP_VERSION_CHECK=on

# Set working directory
WORKDIR /app

# Install native compilation dependencies for geospatial and ML packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source tree and preparation scripts
COPY app/ ./app/
COPY scripts/ ./scripts/

# Expose API & WebSocket service port
EXPOSE 5000

# Health check endpoint probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Launch the FastAPI + python-socketio ASGI entrypoint
CMD ["uvicorn", "app.main:socket_app", "--host", "0.0.0.0", "--port", "5000"]