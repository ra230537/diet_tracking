"""
Bulking Control App — Main Application Entry Point
=====================================================
This is the FastAPI application factory. It:
  1. Creates the FastAPI app instance with metadata
  2. Registers all API routers
  3. Sets up the database lifecycle (create tables on startup)
  4. Configures CORS middleware for frontend integration
  5. Provides a health check endpoint

To run locally (outside Docker):
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

To run with Docker:
  docker-compose up --build
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, async_engine

# Import all routers
from app.routers import body_logs, coach, dashboard, diet, foods

# Configure logging so we can see what's happening in the console
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# ============================================================
# APPLICATION LIFESPAN (Startup / Shutdown)
# ============================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handles application startup and shutdown events.
    
    On STARTUP:
      - Creates all database tables if they don't exist.
      - This uses SQLAlchemy's create_all which is idempotent (safe to run multiple times).
      - In a production app, you'd use Alembic migrations instead.
    
    On SHUTDOWN:
      - Disposes the database engine (closes all connections).
    """
    # ----- STARTUP -----
    logger.info("🚀 Starting Bulking Control App...")
    logger.info(f"📦 Database URL: {settings.DATABASE_URL[:50]}...")

    # Create all tables defined in our models
    # run_sync() lets us run synchronous SQLAlchemy code in the async engine
    async with async_engine.begin() as conn:
        # Import models to ensure they're registered with Base.metadata
        from app import models  # noqa: F401

        await conn.run_sync(Base.metadata.create_all)
        logger.info("✅ Database tables created/verified successfully")

    yield  # Application is running — handle requests

    # ----- SHUTDOWN -----
    logger.info("🛑 Shutting down Bulking Control App...")
    await async_engine.dispose()
    logger.info("✅ Database connections closed")


# ============================================================
# CREATE THE FASTAPI APPLICATION
# ============================================================
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Backend API for the Bulking Control App. "
        "Tracks nutrition, body metrics, and provides intelligent diet adjustments "
        "for optimal weight gain during a bulking phase."
    ),
    lifespan=lifespan,
    # OpenAPI docs configuration
    docs_url="/docs",        # Swagger UI at /docs
    redoc_url="/redoc",      # ReDoc at /redoc
)


# ============================================================
# CORS MIDDLEWARE
# ============================================================
# Allow all origins during development. In production, restrict to your frontend URL.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],         # Change to ["http://localhost:3000"] in production
    allow_credentials=True,
    allow_methods=["*"],         # Allow all HTTP methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],         # Allow all headers
)


# ============================================================
# REGISTER ROUTERS
# ============================================================
# Each router handles a specific domain of the application.
# The prefix is already defined in each router file.
app.include_router(foods.router)        # /foods/*
app.include_router(diet.router)         # /diet/*
app.include_router(body_logs.router)    # /body-logs/*
app.include_router(dashboard.router)    # /dashboard/*
app.include_router(coach.router)        # /coach/*


# ============================================================
# ROOT / HEALTH CHECK ENDPOINT
# ============================================================
@app.get("/", tags=["Health"])
async def root():
    """
    Root endpoint — serves as a health check.
    Returns basic app info to confirm the API is running.
    """
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "healthy",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint for Docker/Kubernetes health probes.
    Returns 200 if the application is running.
    """
    return {"status": "ok"}
