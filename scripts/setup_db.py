#!/usr/bin/env python3
"""
Create the `votes` table in Neon.

Usage:
    uv run --project scripts scripts/setup_db.py

Reads DATABASE_URL from the project .env (or the environment).
"""

import os
import sys
from pathlib import Path

import psycopg

SCHEMA = """
create table if not exists votes (
    id         bigint generated always as identity primary key,
    date       text not null,          -- YYYYMMDD
    vote_id    text not null,
    voter_id     text not null,          
    choice     text not null,
    created_at timestamptz not null default now(),
    unique (date, vote_id, voter_id)     -- one vote per user per (day, vote)
);
"""


def load_env() -> None:
    """Minimal .env loader — no extra dependency needed."""
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def main() -> None:
    load_env()
    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit(
            "DATABASE_URL is not set. Copy .env.example to .env and add your Neon string."
        )

    with psycopg.connect(url) as conn:
        conn.execute(SCHEMA)

    print("✓ votes table ready")


if __name__ == "__main__":
    main()
