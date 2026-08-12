"""
SQLite persistence for the music dashboard.

Currently stores drum-practice sessions. Schema is intentionally tiny
and append-only; this is a prototype, not a production data model.
"""

from __future__ import annotations

import json
import os
import sqlite3
import time
from typing import Any

DB_PATH = os.environ.get("MUSIC_DASHBOARD_DB",
                         os.path.join(os.path.dirname(__file__), "music_dashboard.db"))


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at    REAL NOT NULL,
                tempo         REAL NOT NULL,
                duration_s    REAL NOT NULL,
                accuracy      REAL NOT NULL,
                total_beats   INTEGER NOT NULL,
                hits          INTEGER NOT NULL,
                early         INTEGER NOT NULL,
                late          INTEGER NOT NULL,
                missed        INTEGER NOT NULL,
                hit_offsets   TEXT NOT NULL
            )
            """
        )


def list_sessions(limit: int = 50) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, created_at, tempo, duration_s, accuracy, total_beats, "
            "hits, early, late, missed FROM sessions "
            "ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
    out = []
    for r in rows:
        out.append({
            "id": r["id"],
            "created_at": r["created_at"],
            "tempo": r["tempo"],
            "duration_s": r["duration_s"],
            "accuracy": r["accuracy"],
            "total_beats": r["total_beats"],
            "hits": r["hits"],
            "early": r["early"],
            "late": r["late"],
            "missed": r["missed"],
        })
    return out


def create_session(data: dict[str, Any]) -> dict[str, Any]:
    now = time.time()
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO sessions (created_at, tempo, duration_s, accuracy, "
            "total_beats, hits, early, late, missed, hit_offsets) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                now,
                float(data["tempo"]),
                float(data["duration_s"]),
                float(data["accuracy"]),
                int(data["total_beats"]),
                int(data["hits"]),
                int(data["early"]),
                int(data["late"]),
                int(data["missed"]),
                json.dumps(data.get("hit_offsets", [])),
            ),
        )
        sid = cur.lastrowid
    return {
        "id": sid,
        "created_at": now,
        "tempo": float(data["tempo"]),
        "duration_s": float(data["duration_s"]),
        "accuracy": float(data["accuracy"]),
        "total_beats": int(data["total_beats"]),
        "hits": int(data["hits"]),
        "early": int(data["early"]),
        "late": int(data["late"]),
        "missed": int(data["missed"]),
    }


def delete_session(session_id: int) -> bool:
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        return cur.rowcount > 0