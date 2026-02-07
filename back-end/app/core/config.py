"""
Application Configuration
=========================
Uses pydantic-settings to load environment variables into a typed Settings object.
The DATABASE_URL is the most important setting — it tells SQLAlchemy where to connect.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    The .env file is automatically read thanks to the model_config below.
    """

    # The async PostgreSQL connection string
    # Format: postgresql+asyncpg://user:password@host:port/dbname
    DATABASE_URL: str = (
        "postgresql+asyncpg://bulking_user:bulking_pass@db:5432/bulking_db"
    )

    # Application metadata
    APP_NAME: str = "Bulking Control App"
    APP_VERSION: str = "1.0.0"

    model_config = {"env_file": ".env", "extra": "ignore"}


# Singleton instance — import this everywhere you need settings
settings = Settings()
