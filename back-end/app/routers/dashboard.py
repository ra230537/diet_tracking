"""
Dashboard Router
=================
Endpoints for aggregated statistics and time-series data,
primarily used for charts and overview screens.

Endpoints:
  GET /dashboard/stats - Returns weight history, body fat history, and current plan summary
"""

import logging
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models import BodyLog, DietPlan, Meal, MealItem
from app.schemas import BodyLogResponse, DashboardStats
from app.services.body_fat import calculate_body_fat_from_skinfolds
from app.services.diet_calculator import get_current_diet_full

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    user_id: str = Query(default="default_user", description="User identifier"),
    days: int = Query(
        default=30, ge=7, le=365,
        description="Number of days of history to include"
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    Get aggregated dashboard statistics for charting and overview.
    
    Returns:
      - weight_history: Array of {date, weight_kg} for line charts
      - body_fat_history: Array of {date, body_fat_percent} for line charts
        (includes both bioimpedance and calculated values)
      - current_plan_summary: Target vs actual macros for the active plan
      - latest_body_log: The most recent body measurement entry
    
    The `days` parameter controls how far back the history goes (default: 30).
    """
    start_date = date.today() - timedelta(days=days)

    # ----- 1. Fetch weight and body fat history -----
    stmt = (
        select(BodyLog)
        .where(BodyLog.user_id == user_id)
        .where(BodyLog.date >= start_date)
        .order_by(BodyLog.date.asc())
    )
    result = await db.execute(stmt)
    logs = result.scalars().all()

    # Build weight history array for charts
    weight_history = [
        {"date": log.date.isoformat(), "weight_kg": log.weight_kg}
        for log in logs
    ]

    # Build body fat history array
    # Priority: bioimpedance value > calculated from skinfolds
    body_fat_history = []
    for log in logs:
        fat_percent = None

        # First, check if we have a bioimpedance reading
        if log.bio_body_fat_percent is not None:
            fat_percent = log.bio_body_fat_percent

        # If not, try to calculate from skinfolds
        elif _log_has_all_skinfolds(log):
            bf_result = calculate_body_fat_from_skinfolds(
                chest=log.skinfold_chest,
                axillary=log.skinfold_axillary,
                triceps=log.skinfold_triceps,
                subscapular=log.skinfold_subscapular,
                suprailiac=log.skinfold_suprailiac,
                abdominal=log.skinfold_abdominal,
                thigh=log.skinfold_thigh,
            )
            fat_percent = bf_result["body_fat_percent"]

        if fat_percent is not None:
            body_fat_history.append({
                "date": log.date.isoformat(),
                "body_fat_percent": fat_percent,
            })

    # ----- 2. Get current diet plan summary -----
    plan_summary = None
    try:
        plan_data = await get_current_diet_full(db, user_id)
        plan_summary = {
            "target_calories": plan_data["calories_comparison"]["target"],
            "actual_calories": plan_data["calories_comparison"]["actual"],
            "target_protein": plan_data["protein_comparison"]["target"],
            "actual_protein": plan_data["protein_comparison"]["actual"],
            "target_carbs": plan_data["carbs_comparison"]["target"],
            "actual_carbs": plan_data["carbs_comparison"]["actual"],
            "target_fat": plan_data["fat_comparison"]["target"],
            "actual_fat": plan_data["fat_comparison"]["actual"],
        }
    except ValueError:
        # No active plan — that's okay, just return None
        plan_summary = None

    # ----- 3. Get the latest body log -----
    latest_log = None
    if logs:
        last_log = logs[-1]  # Already sorted ascending, so last = most recent
        latest_log = BodyLogResponse.model_validate(last_log)

        # Calculate body fat for the latest log if possible
        if _log_has_all_skinfolds(last_log):
            bf_result = calculate_body_fat_from_skinfolds(
                chest=last_log.skinfold_chest,
                axillary=last_log.skinfold_axillary,
                triceps=last_log.skinfold_triceps,
                subscapular=last_log.skinfold_subscapular,
                suprailiac=last_log.skinfold_suprailiac,
                abdominal=last_log.skinfold_abdominal,
                thigh=last_log.skinfold_thigh,
            )
            latest_log.calculated_body_density = bf_result["body_density"]
            latest_log.calculated_body_fat_percent = bf_result["body_fat_percent"]

    return DashboardStats(
        weight_history=weight_history,
        body_fat_history=body_fat_history,
        current_plan_summary=plan_summary,
        latest_body_log=latest_log,
    )


def _log_has_all_skinfolds(log: BodyLog) -> bool:
    """Check if a BodyLog has all 7 skinfold measurements for Pollock calculation."""
    return all([
        log.skinfold_chest is not None,
        log.skinfold_axillary is not None,
        log.skinfold_triceps is not None,
        log.skinfold_subscapular is not None,
        log.skinfold_suprailiac is not None,
        log.skinfold_abdominal is not None,
        log.skinfold_thigh is not None,
    ])
