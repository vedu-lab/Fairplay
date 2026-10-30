"""
FastAPI application entry point.
Provides a simple health check at /api/health.
"""

from fastapi import FastAPI
from .config import settings

app = FastAPI(title="FairPlay Backend")

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

# Additional routes will be added in future phases.

