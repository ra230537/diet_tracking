"""
Body Logs Router
=================
Endpoints for managing body measurements and progress tracking.

Endpoints:
  POST /body-logs/          - Create a new body log entry
  GET  /body-logs/          - List body logs (with date filtering)
  GET  /body-logs/{log_id}  - Get a specific body log by ID
"""

import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import BodyLog
from app.schemas import BodyLogCreate, BodyLogResponse, BodyLogUpdate, MessageResponse
from app.services.body_fat import calculate_body_fat_from_skinfolds

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/body-logs", tags=["Body Logs"])


@router.post("/", response_model=BodyLogResponse, status_code=201)
async def create_body_log(
    log: BodyLogCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new body measurement log entry.
    
    Only `date` and `weight_kg` are required. All other fields are optional,
    allowing flexible logging:
      - Quick log: just weight
      - Bioimpedance log: weight + body fat % + muscle mass
      - Skinfold log: weight + 7 skinfold sites (body fat is auto-calculated)
      - Circumference log: weight + tape measurements
      - Full log: everything at once
    
    If all 7 skinfold measurements are provided, body density and body fat %
    are automatically calculated using the Pollock 7-fold method.
    """
    # Create the database record from the request data
    db_log = BodyLog(**log.model_dump())

    db.add(db_log)
    await db.commit()
    await db.refresh(db_log)

    # Build the response
    response_data = BodyLogResponse.model_validate(db_log)

    # If all 7 skinfold measurements are present, calculate body fat
    if _has_all_skinfolds(log):
        body_fat_result = calculate_body_fat_from_skinfolds(
            chest=log.skinfold_chest,  # type: ignore
            axillary=log.skinfold_axillary,  # type: ignore
            triceps=log.skinfold_triceps,  # type: ignore
            subscapular=log.skinfold_subscapular,  # type: ignore
            suprailiac=log.skinfold_suprailiac,  # type: ignore
            abdominal=log.skinfold_abdominal,  # type: ignore
            thigh=log.skinfold_thigh,  # type: ignore
        )
        response_data.calculated_body_density = body_fat_result["body_density"]
        response_data.calculated_body_fat_percent = body_fat_result["body_fat_percent"]

        logger.info(
            f"Body fat calculated for log {db_log.id}: "
            f"{body_fat_result['body_fat_percent']}% "
            f"(density: {body_fat_result['body_density']})"
        )

    logger.info(
        f"Created body log ID {db_log.id} for date {db_log.date}: "
        f"weight={db_log.weight_kg}kg"
    )
    return response_data


@router.get("/", response_model=list[BodyLogResponse])
async def list_body_logs(
    user_id: str = Query(default="default_user", description="User identifier"),
    start_date: Optional[date] = Query(
        default=None, description="Filter logs from this date (inclusive)"
    ),
    end_date: Optional[date] = Query(
        default=None, description="Filter logs until this date (inclusive)"
    ),
    skip: int = Query(default=0, ge=0, description="Pagination offset"),
    limit: int = Query(default=50, ge=1, le=200, description="Max records to return"),
    db: AsyncSession = Depends(get_db),
):
    """
    List body log entries with optional date range filtering.
    
    Results are ordered by date descending (most recent first).
    Supports pagination via `skip` and `limit`.
    
    Examples:
      GET /body-logs/                              -> All logs
      GET /body-logs/?start_date=2024-01-01        -> Logs from Jan 1 onwards
      GET /body-logs/?start_date=2024-01-01&end_date=2024-01-31 -> January only
    """
    stmt = select(BodyLog).where(BodyLog.user_id == user_id)

    # Apply date filters if provided
    if start_date:
        stmt = stmt.where(BodyLog.date >= start_date)
    if end_date:
        stmt = stmt.where(BodyLog.date <= end_date)

    # Order by date descending, apply pagination
    stmt = stmt.order_by(BodyLog.date.desc()).offset(skip).limit(limit)

    result = await db.execute(stmt)
    logs = result.scalars().all()

    # For each log, calculate body fat if skinfolds are present
    response_logs = []
    for log in logs:
        response_data = BodyLogResponse.model_validate(log)

        # Check if this log has all 7 skinfolds and calculate body fat
        if _log_has_all_skinfolds(log):
            body_fat_result = calculate_body_fat_from_skinfolds(
                chest=log.skinfold_chest,
                axillary=log.skinfold_axillary,
                triceps=log.skinfold_triceps,
                subscapular=log.skinfold_subscapular,
                suprailiac=log.skinfold_suprailiac,
                abdominal=log.skinfold_abdominal,
                thigh=log.skinfold_thigh,
            )
            response_data.calculated_body_density = body_fat_result["body_density"]
            response_data.calculated_body_fat_percent = body_fat_result["body_fat_percent"]

        response_logs.append(response_data)

    return response_logs


@router.get("/{log_id}", response_model=BodyLogResponse)
async def get_body_log(
    log_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Get a specific body log entry by ID.
    
    If skinfold measurements are present, body fat % is automatically
    calculated and included in the response.
    """
    stmt = select(BodyLog).where(BodyLog.id == log_id)
    result = await db.execute(stmt)
    log = result.scalar_one_or_none()

    if not log:
        raise HTTPException(
            status_code=404,
            detail=f"Body log with ID {log_id} not found."
        )

    response_data = BodyLogResponse.model_validate(log)

    # Calculate body fat if all skinfolds are present
    if _log_has_all_skinfolds(log):
        body_fat_result = calculate_body_fat_from_skinfolds(
            chest=log.skinfold_chest,
            axillary=log.skinfold_axillary,
            triceps=log.skinfold_triceps,
            subscapular=log.skinfold_subscapular,
            suprailiac=log.skinfold_suprailiac,
            abdominal=log.skinfold_abdominal,
            thigh=log.skinfold_thigh,
        )
        response_data.calculated_body_density = body_fat_result["body_density"]
        response_data.calculated_body_fat_percent = body_fat_result["body_fat_percent"]

    return response_data


@router.put("/{log_id}", response_model=BodyLogResponse)
async def update_body_log(
    log_id: int,
    update: BodyLogUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Update an existing body log entry.
    
    Only the fields provided in the request body will be updated.
    Fields not included will remain unchanged.
    """
    stmt = select(BodyLog).where(BodyLog.id == log_id)
    result = await db.execute(stmt)
    log = result.scalar_one_or_none()

    if not log:
        raise HTTPException(
            status_code=404,
            detail=f"Body log with ID {log_id} not found."
        )

    # Update only the fields that were explicitly provided
    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(log, field, value)

    await db.commit()
    await db.refresh(log)

    # Build response with optional body fat calculation
    response_data = BodyLogResponse.model_validate(log)
    if _log_has_all_skinfolds(log):
        body_fat_result = calculate_body_fat_from_skinfolds(
            chest=log.skinfold_chest,
            axillary=log.skinfold_axillary,
            triceps=log.skinfold_triceps,
            subscapular=log.skinfold_subscapular,
            suprailiac=log.skinfold_suprailiac,
            abdominal=log.skinfold_abdominal,
            thigh=log.skinfold_thigh,
        )
        response_data.calculated_body_density = body_fat_result["body_density"]
        response_data.calculated_body_fat_percent = body_fat_result["body_fat_percent"]

    logger.info(f"Updated body log ID {log_id}")
    return response_data


@router.delete("/{log_id}", response_model=MessageResponse)
async def delete_body_log(
    log_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a body log entry.
    """
    stmt = select(BodyLog).where(BodyLog.id == log_id)
    result = await db.execute(stmt)
    log = result.scalar_one_or_none()

    if not log:
        raise HTTPException(
            status_code=404,
            detail=f"Body log with ID {log_id} not found."
        )

    await db.delete(log)
    await db.commit()

    logger.info(f"Deleted body log ID {log_id}")
    return MessageResponse(
        message="Body log deleted successfully.",
        detail=f"Deleted log ID {log_id} from {log.date}."
    )


# ----- Helper Functions -----

def _has_all_skinfolds(log: BodyLogCreate) -> bool:
    """
    Check if a BodyLogCreate schema has all 7 skinfold measurements.
    Returns True only if ALL 7 sites have non-None values.
    """
    return all([
        log.skinfold_chest is not None,
        log.skinfold_axillary is not None,
        log.skinfold_triceps is not None,
        log.skinfold_subscapular is not None,
        log.skinfold_suprailiac is not None,
        log.skinfold_abdominal is not None,
        log.skinfold_thigh is not None,
    ])


def _log_has_all_skinfolds(log: BodyLog) -> bool:
    """
    Check if a BodyLog ORM model has all 7 skinfold measurements.
    Returns True only if ALL 7 sites have non-None values.
    """
    return all([
        log.skinfold_chest is not None,
        log.skinfold_axillary is not None,
        log.skinfold_triceps is not None,
        log.skinfold_subscapular is not None,
        log.skinfold_suprailiac is not None,
        log.skinfold_abdominal is not None,
        log.skinfold_thigh is not None,
    ])
