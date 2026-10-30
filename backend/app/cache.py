# Empty SQLite cache setup
import sqlite3

def get_connection(db_path: str = "cache.db"):
    conn = sqlite3.connect(db_path)
    # No schema defined yet
    return conn

