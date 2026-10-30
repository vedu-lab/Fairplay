"""
SQLite cache for GitHub API responses.
Caches raw PR data by (username, since, until) so repeated requests
do not re-query GitHub within the event window.
"""

import json
import sqlite3
from typing import Any, Dict, List, Optional
from .config import settings

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
        conn.commit()

def get_cached_prs(username: str, since: str, until: str, db_path: Optional[str] = None) -> Optional[List[Dict[str, Any]]]:
    """Retrieve cached raw PR records for a user and date window, or None if miss."""
    init_db(db_path)
    clean_user = username.strip().lower()
    clean_since = since.strip()
    clean_until = until.strip()

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

def set_cached_prs(username: str, since: str, until: str, prs: List[Dict[str, Any]], db_path: Optional[str] = None) -> None:
    """Save raw PR records to cache for a given user and date window."""
    init_db(db_path)
    clean_user = username.strip().lower()
    clean_since = since.strip()
    clean_until = until.strip()
    payload = json.dumps(prs)

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
