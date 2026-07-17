import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from sqlalchemy import (
    Column,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    create_engine,
    inspect,
    text,
)
from sqlalchemy.orm import declarative_base, sessionmaker

# Loads backend/.env into the process environment for local development (e.g. to
# point DATABASE_URL at a Postgres instance without exporting it in the shell).
# In production the platform (Render, Railway, etc.) sets real env vars directly,
# so this is a no-op there -- it only fills in vars that aren't already set.
load_dotenv()

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./journal.db")

if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace(
        "postgres://", "postgresql://", 1
    )

connect_args = (
    {"check_same_thread": False} if "sqlite" in SQLALCHEMY_DATABASE_URL else {}
)

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Watchlist(Base):
    __tablename__ = "watchlist"

    id = Column(Integer, primary_key=True)
    ticker = Column(String, unique=True, nullable=False)
    # Populated opportunistically by GET /api/analyze/{ticker} (which already pays
    # for the yfinance .info call for scoring), so /api/watchlist/summary can read
    # them straight from the DB instead of re-hitting yfinance per ticker.
    name = Column(String, nullable=True)
    fundamental_score = Column(Float, nullable=True)


class ResearchNote(Base):
    __tablename__ = "research_notes"

    id = Column(Integer, primary_key=True)
    ticker = Column(String, unique=True, nullable=False)
    content = Column(Text, nullable=False)
    author = Column(String, nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class AlgoConfig(Base):
    """Singleton row (always id=1) of tunable parameters for the Java
    execution engine's mean-reversion strategy. This app only reads/writes
    the row -- it has no channel to the engine itself, so these values only
    take effect if/however the engine is set up to poll this table. See
    GET/POST /api/bot/config in main.py.
    """

    __tablename__ = "algo_config"

    id = Column(Integer, primary_key=True)
    ma_lookback_period = Column(Integer, nullable=False, default=20)
    std_dev_multiplier = Column(Float, nullable=False, default=2.0)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class ExecutionLedger(Base):
    """A trade record pushed in by the Java execution engine via the
    authenticated POST /api/webhooks/execute webhook (see main.py). This
    table is this app's only real inbound channel from the engine -- unlike
    AlgoConfig (which the engine may or may not poll), a row here means the
    engine actually told this app it executed a trade.
    """

    __tablename__ = "execution_ledger"

    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    ticker = Column(String, nullable=False)
    action = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    price = Column(Float, nullable=False)
    strategy = Column(String, nullable=False, default="Mean Reversion")


def init_db():
    Base.metadata.create_all(bind=engine)
    _add_missing_columns("watchlist", {"name": "VARCHAR", "fundamental_score": "FLOAT"})
    _add_missing_columns("research_notes", {"author": "VARCHAR"})


def _add_missing_columns(table_name: str, columns: dict) -> None:
    """Add columns introduced after a table was first created.

    Base.metadata.create_all() only creates missing tables; it never alters existing
    ones, so columns added to a model after its table already exists need this
    one-time, idempotent backfill (works for both SQLite and Postgres). table_name/
    columns are always internal constants from call sites above, never user input.
    """
    inspector = inspect(engine)
    existing_columns = {col["name"] for col in inspector.get_columns(table_name)}

    with engine.begin() as conn:
        for column_name, column_type in columns.items():
            if column_name not in existing_columns:
                conn.execute(
                    text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")
                )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
