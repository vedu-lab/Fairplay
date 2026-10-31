"""
FastAPI application entry point for FairPlay.
Provides:
  - POST /api/verify-token: Validates GitHub PAT and returns user & rate limit details
  - GET /api/health: Service status & configured token info
  - GET /api/leaderboard: Audited, scored, anti-gaming PR leaderboard with graphical analysis metrics
  - GET /api/repo/audit: Track target repository changelog and lead contributors
  - Single-process deployment: Serves built Vite/React frontend from frontend/dist securely (path-traversal hardened)
"""

import asyncio
from datetime import datetime
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Tuple
from fastapi import FastAPI, HTTPException, Header, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .cache import (
    cached_fetch_repo_prs,
    cached_fetch_user_prs,
    get_cached_prs,
    get_cached_repo_prs,
    init_db,
    set_cached_prs,
    set_cached_repo_prs,
)
from .config import settings
from .github_client import fetch_repo_prs, fetch_user_prs, verify_github_token
from .scoring import score_repo_prs, score_user_prs

app = FastAPI(
    title="FairPlay Anti-Gaming PR Leaderboard",
    description="Scores PRs on a transparent 4-signal weighted rubric and auto-flags gaming patterns.",
    version="1.0.0",
)

# Enable CORS for local development
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


def _extract_token(request: Request, x_github_token: Optional[str] = None) -> Optional[str]:
    """Extract custom GitHub token from header if supplied, else fallback to settings."""
    sanitized_header = settings.sanitize_github_token(x_github_token)
    if sanitized_header and sanitized_header != "default":
        return sanitized_header
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        sanitized_auth = settings.sanitize_github_token(auth_header[7:])
        if sanitized_auth and sanitized_auth != "default":
            return sanitized_auth
    return None


def _validate_date_window(since: Optional[str], until: Optional[str]) -> Tuple[str, str]:
    """Validates date format and ensures since <= until."""
    date_regex = re.compile(r"^\d{4}-\d{2}-\d{2}$")
    since_str = (since or "").strip()
    until_str = (until or "").strip()

    if since_str and not date_regex.match(since_str):
        raise HTTPException(status_code=400, detail=f"Invalid 'since' date format '{since_str}'. Must be YYYY-MM-DD.")
    if until_str and not date_regex.match(until_str):
        raise HTTPException(status_code=400, detail=f"Invalid 'until' date format '{until_str}'. Must be YYYY-MM-DD.")

    if since_str and until_str:
        try:
            d_since = datetime.strptime(since_str, "%Y-%m-%d")
            d_until = datetime.strptime(until_str, "%Y-%m-%d")
            if d_since > d_until:
                raise HTTPException(
                    status_code=400,
                    detail=f"Start date 'since' ({since_str}) cannot be after end date 'until' ({until_str}).",
                )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"Invalid calendar date: {exc}")

    return since_str, until_str


def _validate_username(username: str) -> str:
    """Validates GitHub username format."""
    clean = username.strip()
    if not clean or not re.match(r"^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$", clean) or len(clean) > 39:
        raise HTTPException(status_code=400, detail=f"Invalid GitHub username '{clean}'. Must be alphanumeric with single hyphens.")
    return clean


class TokenVerifyRequest(BaseModel):
    token: Optional[str] = ""


@app.post("/api/verify-token")
async def verify_token_endpoint(body: TokenVerifyRequest):
    """
    Verifies a GitHub PAT and returns authenticated identity and rate limit quotas.
    """
    result = await verify_github_token(body.token)
    return result


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "service": "fairplay-backend",
        "has_github_token": bool(settings.GITHUB_TOKEN),
    }


async def _process_user(
    username: str, since: str, until: str, force_refresh: bool, token: Optional[str] = None
) -> Dict[str, Any]:
    clean_user = username.strip()
    if not clean_user:
        return {}

    # Check SQLite cache
    cached_prs = None if force_refresh else get_cached_prs(clean_user, since, until)
    from_cache = cached_prs is not None
    prs = await cached_fetch_user_prs(clean_user, since, until, token=token, force_refresh=force_refresh)

    result = score_user_prs(clean_user, prs)
    result["cached"] = from_cache
    return result


@app.get("/api/leaderboard")
async def get_leaderboard(
    request: Request,
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
    x_github_token: Optional[str] = Header(None, alias="X-GitHub-Token"),
):
    """
    Audit and score PRs for the given users across the event window.
    Returns ranked leaderboard with transparent per-PR rubric breakdowns,
    loss analysis, and gaming flags.
    """
    raw_list = [u.strip() for u in usernames.split(",") if u.strip()]
    if not raw_list:
        raise HTTPException(status_code=400, detail="At least one valid GitHub username must be provided.")

    user_list = [_validate_username(u) for u in raw_list]
    since_str, until_str = _validate_date_window(since, until)
    token = _extract_token(request, x_github_token)

    tasks = [
        _process_user(u, since_str, until_str, force_refresh, token=token)
        for u in user_list
    ]
    raw_results = await asyncio.gather(*tasks, return_exceptions=True)

    leaderboard: List[Dict[str, Any]] = []
    for res in raw_results:
        if isinstance(res, dict) and res:
            leaderboard.append(res)
        elif isinstance(res, Exception):
            continue

    leaderboard.sort(key=lambda x: (x.get("total_score", 0), x.get("pr_count", 0)), reverse=True)

    for index, entry in enumerate(leaderboard, start=1):
        entry["rank"] = index

    return leaderboard


@app.get("/api/repo/audit")
async def get_repo_audit(
    request: Request,
    repo: str = Query(..., description="Target repository in format 'owner/repo' (e.g. 'facebook/react')"),
    since: Optional[str] = Query(None, description="Start date of hackathon window (YYYY-MM-DD)"),
    until: Optional[str] = Query(None, description="End date of hackathon window (YYYY-MM-DD)"),
    force_refresh: bool = Query(False, description="Set true to bypass local cache"),
    x_github_token: Optional[str] = Header(None, alias="X-GitHub-Token"),
):
    """
    Audit all PRs submitted to a target repository.
    Returns changelog and lead contributors taking the lead in this specific repository.
    """
    clean_repo = repo.strip()
    if not clean_repo or not re.match(r"^[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$", clean_repo):
        raise HTTPException(status_code=400, detail="Target repository must be in 'owner/repo' format (e.g. 'facebook/react').")

    since_str, until_str = _validate_date_window(since, until)
    token = _extract_token(request, x_github_token)

    cached_prs = None if force_refresh else get_cached_repo_prs(clean_repo, since_str, until_str)
    from_cache = cached_prs is not None
    prs = await cached_fetch_repo_prs(clean_repo, since_str, until_str, token=token, force_refresh=force_refresh)

    result = score_repo_prs(clean_repo, prs)
    result["cached"] = from_cache
    return result


# ═══════════════════════════════════════════════════════════════
# SINGLE PROCESS FRONTEND STATIC SERVING (HARDENED AGAINST PATH TRAVERSAL)
# ═══════════════════════════════════════════════════════════════
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
DIST_DIR = (ROOT_DIR / "frontend" / "dist").resolve()

if DIST_DIR.exists() and (DIST_DIR / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        try:
            # Resolve candidate path and verify it stays strictly inside DIST_DIR
            candidate = (DIST_DIR / full_path).resolve()
            if candidate.is_relative_to(DIST_DIR) and candidate.is_file():
                return FileResponse(candidate)
        except Exception:
            pass
        return FileResponse(DIST_DIR / "index.html")
