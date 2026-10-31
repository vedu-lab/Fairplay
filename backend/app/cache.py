"""
SQLite cache for GitHub API responses.
Caches raw PR data by (username, since, until) and (repo, since, until)
so repeated requests do not re-query GitHub within the event window.
"""

import json
import logging
import sqlite3
from typing import Any, Dict, List, Optional
from .config import settings

logger = logging.getLogger(__name__)

def get_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    path = db_path or settings.CACHE_DB_PATH
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn

def init_db(db_path: Optional[str] = None) -> None:
    """Initialize the cache schema if it does not already exist."""
    with get_connection(db_path) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS pr_cache (
                username TEXT NOT NULL,
                since TEXT NOT NULL,
                until TEXT NOT NULL,
                data TEXT NOT NULL,
                cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (username, since, until)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS repo_cache (
                repo TEXT NOT NULL,
                since TEXT NOT NULL,
                until TEXT NOT NULL,
                data TEXT NOT NULL,
                cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (repo, since, until)
            )
            """
        )
        conn.commit()

def get_cached_prs(
    username: str,
    since: Optional[str] = None,
    until: Optional[str] = None,
    db_path: Optional[str] = None,
) -> Optional[List[Dict[str, Any]]]:
    """Retrieve cached raw PR records for a user and date window, or None if miss."""
    init_db(db_path)
    clean_user = username.strip().lower()
    clean_since = (since or "").strip()
    clean_until = (until or "").strip()

    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT data FROM pr_cache WHERE username = ? AND since = ? AND until = ?",
            (clean_user, clean_since, clean_until),
        )
        row = cursor.fetchone()
        if row:
            try:
                return json.loads(row["data"])
            except json.JSONDecodeError:
                return None
    return None

def set_cached_prs(
    username: str,
    since: Optional[str] = None,
    until: Optional[str] = None,
    prs: Optional[List[Dict[str, Any]]] = None,
    db_path: Optional[str] = None,
) -> None:
    """Save raw PR records to cache for a given user and date window."""
    init_db(db_path)
    clean_user = username.strip().lower()
    clean_since = (since or "").strip()
    clean_until = (until or "").strip()
    payload = json.dumps(prs if prs is not None else [])

    with get_connection(db_path) as conn:
        conn.execute(
            """
            INSERT INTO pr_cache (username, since, until, data, cached_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(username, since, until) DO UPDATE SET
                data = excluded.data,
                cached_at = CURRENT_TIMESTAMP
            """,
            (clean_user, clean_since, clean_until, payload),
        )
        conn.commit()

def get_cached_repo_prs(
    repo: str,
    since: Optional[str] = None,
    until: Optional[str] = None,
    db_path: Optional[str] = None,
) -> Optional[List[Dict[str, Any]]]:
    """Retrieve cached raw PR records for a repository and date window."""
    init_db(db_path)
    clean_repo = repo.strip().lower()
    clean_since = (since or "").strip()
    clean_until = (until or "").strip()

    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT data FROM repo_cache WHERE repo = ? AND since = ? AND until = ?",
            (clean_repo, clean_since, clean_until),
        )
        row = cursor.fetchone()
        if row:
            try:
                return json.loads(row["data"])
            except json.JSONDecodeError:
                return None
    return None

def set_cached_repo_prs(
    repo: str,
    since: Optional[str] = None,
    until: Optional[str] = None,
    prs: Optional[List[Dict[str, Any]]] = None,
    db_path: Optional[str] = None,
) -> None:
    """Save raw PR records to cache for a repository and date window."""
    init_db(db_path)
    clean_repo = repo.strip().lower()
    clean_since = (since or "").strip()
    clean_until = (until or "").strip()
    payload = json.dumps(prs if prs is not None else [])

    with get_connection(db_path) as conn:
        conn.execute(
            """
            INSERT INTO repo_cache (repo, since, until, data, cached_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(repo, since, until) DO UPDATE SET
                data = excluded.data,
                cached_at = CURRENT_TIMESTAMP
            """,
            (clean_repo, clean_since, clean_until, payload),
        )
        conn.commit()

def clear_cache(
    username: Optional[str] = None,
    repo: Optional[str] = None,
    db_path: Optional[str] = None,
) -> None:
    """Clear all or selective cache records."""
    init_db(db_path)
    with get_connection(db_path) as conn:
        if username:
            conn.execute("DELETE FROM pr_cache WHERE username = ?", (username.strip().lower(),))
        elif repo:
            conn.execute("DELETE FROM repo_cache WHERE repo = ?", (repo.strip().lower(),))
        else:
            conn.execute("DELETE FROM pr_cache")
            conn.execute("DELETE FROM repo_cache")
        conn.commit()

async def cached_fetch_user_prs(
    username: str,
    since: Optional[str] = None,
    until: Optional[str] = None,
    token: Optional[str] = None,
    force_refresh: bool = False,
    db_path: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Wrap fetch_user_prs from app.github_client with SQLite caching keyed on (username, since, until).
    If cached data exists and force_refresh is False, returns cached PRs without querying GitHub.
    """
    from .github_client import fetch_user_prs

    clean_user = username.strip().lower()
    clean_since = (since or "").strip()
    clean_until = (until or "").strip()

    if not force_refresh:
        cached = get_cached_prs(clean_user, clean_since, clean_until, db_path=db_path)
        if cached is not None:
            logger.info("Cache HIT for user '%s' (%s - %s)", clean_user, clean_since, clean_until)
            return cached

    logger.info("Cache MISS for user '%s' (%s - %s), querying GitHub API", clean_user, clean_since, clean_until)
    prs = await fetch_user_prs(username, since=since, until=until, token=token)
    set_cached_prs(clean_user, clean_since, clean_until, prs, db_path=db_path)
    return prs

fetch_user_prs_cached = cached_fetch_user_prs


async def cached_fetch_repo_prs(
    repo: str,
    since: Optional[str] = None,
    until: Optional[str] = None,
    token: Optional[str] = None,
    force_refresh: bool = False,
    db_path: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Wrap fetch_repo_prs from app.github_client with SQLite caching keyed on (repo, since, until).
    If cached data exists and force_refresh is False, returns cached PRs without querying GitHub.
    """
    from .github_client import fetch_repo_prs

    clean_repo = repo.strip().lower()
    clean_since = (since or "").strip()
    clean_until = (until or "").strip()

    if not force_refresh:
        cached = get_cached_repo_prs(clean_repo, clean_since, clean_until, db_path=db_path)
        if cached is not None:
            logger.info("Cache HIT for repo '%s' (%s - %s)", clean_repo, clean_since, clean_until)
            return cached

    logger.info("Cache MISS for repo '%s' (%s - %s), querying GitHub API", clean_repo, clean_since, clean_until)
    prs = await fetch_repo_prs(repo, since=since, until=until, token=token)
    set_cached_repo_prs(clean_repo, clean_since, clean_until, prs, db_path=db_path)
    return prs

fetch_repo_prs_cached = cached_fetch_repo_prs
