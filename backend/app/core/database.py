import threading
from contextlib import contextmanager
from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False, "timeout": 30},
    pool_pre_ping=True,
)


@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=10000")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()

# Global maintenance mode flag and lock
_maintenance_mode = False
_maintenance_lock = threading.Lock()


def is_maintenance_mode() -> bool:
    global _maintenance_mode
    return _maintenance_mode


def set_maintenance_mode(status: bool):
    global _maintenance_mode
    with _maintenance_lock:
        _maintenance_mode = status


@contextmanager
def maintenance_context():
    """Acquires maintenance mode lock, closing engine connections during restore."""
    set_maintenance_mode(True)
    try:
        engine.dispose()
        yield
    finally:
        set_maintenance_mode(False)


def get_db():
    if is_maintenance_mode():
        raise HTTPException(
            status_code=503,
            detail="System is currently in maintenance mode for database backup/restore. Please try again shortly.",
        )
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()