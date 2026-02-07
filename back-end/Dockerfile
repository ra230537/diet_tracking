# ============================================================
# Dockerfile for the Bulking Control App (FastAPI Backend)
# Uses Python 3.11 slim image to keep the image small.
# ============================================================

FROM python:3.11-slim

# Set the working directory inside the container
WORKDIR /app

# Install system dependencies needed by asyncpg (PostgreSQL async driver)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker layer caching.
# This means if requirements.txt doesn't change, pip install is cached.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire application source code into the container
COPY . .

# Expose the port that uvicorn will listen on
EXPOSE 8000

# Start the FastAPI application with uvicorn
# --host 0.0.0.0 ensures the server is accessible outside the container
# --reload enables auto-reload during development (remove in production)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
