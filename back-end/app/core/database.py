"""
Async Database Engine & Session Factory
========================================
This module sets up the async SQLAlchemy engine and provides:
  - `async_engine`: the connection pool to PostgreSQL
  - `AsyncSessionLocal`: a session factory for creating DB sessions
  - `get_db()`: a FastAPI dependency that yields a session per request

All database operations in this project use async/await for non-blocking I/O.
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# Create the async engine.
# `echo=False` suppresses SQL logging in production. Set to True for debugging.
async_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=20,          # Maximum number of persistent connections in the pool
    max_overflow=10,       # Extra connections allowed beyond pool_size under load
)

# Session factory — each call to AsyncSessionLocal() creates a new session.
# expire_on_commit=False prevents attributes from being expired after commit,
# which avoids extra lazy-load queries in async context.
AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """
    Base class for all SQLAlchemy models.
    All models inherit from this to share the same metadata registry.
    """
    pass


async def get_db():
    """
    FastAPI dependency that provides a database session.
    
    Usage in a route:
        @router.get("/example")
        async def example(db: AsyncSession = Depends(get_db)):
            ...
    
    The session is automatically closed when the request is done,
    even if an exception occurs (thanks to the finally block).
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
