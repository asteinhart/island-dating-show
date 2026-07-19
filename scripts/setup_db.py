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

-- Single-row table holding "what /voter should show right now". The presenter
-- deck (/slides) upserts row 1 on every slide change, voters poll it.
create table if not exists presentation_state (
    id         int primary key default 1,
    state      text not null default 'idle',   -- a scene id from src/lib/voterScenes.js
    slide_id   text,                            -- current deck slide's manifest id (null on the welcome slide)
    updated_at timestamptz not null default now(),
    constraint one_row check (id = 1)
);
-- Add slide_id to pre-existing tables created before this column existed.
alter table presentation_state add column if not exists slide_id text;
insert into presentation_state (id, state) values (1, 'idle')
on conflict (id) do nothing;
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

    # psycopg3's execute() sends one statement per call, so run each separately.
    statements = [s.strip() for s in SCHEMA.split(";") if s.strip()]
    with psycopg.connect(url) as conn:
        for statement in statements:
            conn.execute(statement)

    print("✓ votes + presentation_state tables ready")


if __name__ == "__main__":
    main()
