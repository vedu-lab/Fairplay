"""
FastAPI application entry point for FairPlay.
Provides:
  - GET /api/health: Service status
  - GET /api/leaderboard: Audited, scored, anti-gaming PR leaderboard
  - Single-process deployment: Serves built Vite/React frontend from frontend/dist
"""

import asyncio
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .cache import get_cached_prs, init_db, set_cached_prs
from .config import settings
from .github_client import fetch_user_prs
from .scoring import score_user_prs

app = FastAPI(
    title="FairPlay Anti-Gaming PR Leaderboard",
    description="Scores PRs on a transparent 4-signal weighted rubric and auto-flags gaming patterns.",
    version="1.0.0",
)

# Enable CORS for local development (e.g. Vite dev server)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    init_db()


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "service": "fairplay-backend",
        "has_github_token": bool(settings.GITHUB_TOKEN),
    }


async def _process_user(
    username: str, since: str, until: str, force_refresh: bool
) -> Dict[str, Any]:
    clean_user = username.strip()
    if not clean_user:
        return {}

    # Check SQLite cache
    cached_prs = None if force_refresh else get_cached_prs(clean_user, since, until)

    if cached_prs is not None:
        prs = cached_prs
        from_cache = True
    else:
        prs = await fetch_user_prs(clean_user, since, until)
        set_cached_prs(clean_user, since, until, prs)
        from_cache = False

    result = score_user_prs(clean_user, prs)
    result["cached"] = from_cache
    return result


@app.get("/api/leaderboard")
async def get_leaderboard(
    usernames: str = Query(
        ...,
        description="Comma-separated GitHub usernames (e.g. 'vedu-lab,octocat')",
        examples=["vedu-lab,octocat"],
    ),
    since: Optional[str] = Query(
        None, description="Start date of hackathon window (YYYY-MM-DD)", examples=["2026-10-01"]
    ),
    until: Optional[str] = Query(
        None, description="End date of hackathon window (YYYY-MM-DD)", examples=["2026-10-31"]
    ),
    force_refresh: bool = Query(
        False, description="Set true to bypass local SQLite cache and re-query GitHub"
    ),
):
    """
    Audit and score PRs for the given users across the event window.
    Returns ranked leaderboard with transparent per-PR rubric breakdowns and gaming flags.
    """
    user_list = [u.strip() for u in usernames.split(",") if u.strip()]
    if not user_list:
        raise HTTPException(status_code=400, detail="At least one valid GitHub username must be provided.")

    since_str = since.strip() if since else ""
    until_str = until.strip() if until else ""

    # Concurrently fetch & score across all submitted participants
    tasks = [
        _process_user(u, since_str, until_str, force_refresh)
        for u in user_list
    ]
    raw_results = await asyncio.gather(*tasks, return_exceptions=True)

    leaderboard: List[Dict[str, Any]] = []
    for res in raw_results:
        if isinstance(res, dict) and res:
            leaderboard.append(res)
        elif isinstance(res, Exception):
            # Log exception, don't crash entire leaderboard
            continue

    # Sort leaderboard by total_score descending, then pr_count descending
    leaderboard.sort(key=lambda x: (x.get("total_score", 0.0), x.get("pr_count", 0)), reverse=True)

    # Assign sequential ranks
    for index, entry in enumerate(leaderboard, start=1):
        entry["rank"] = index

    return leaderboard


# ═══════════════════════════════════════════════════════════════
# SINGLE PROCESS FRONTEND STATIC SERVING
# ═══════════════════════════════════════════════════════════════
# Locate frontend/dist relative to project root or backend folder
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
DIST_DIR = ROOT_DIR / "frontend" / "dist"

if DIST_DIR.exists() and (DIST_DIR / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = DIST_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(DIST_DIR / "index.html")
