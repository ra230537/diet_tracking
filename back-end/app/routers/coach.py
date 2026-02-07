"""
Bulking Coach Router — Floating Anchor & Calories-First Strategy
=================================================================
Endpoints for the intelligent coaching system that analyzes weight trends
using time-normalized analysis and suggests calorie/carb adjustments.

Endpoints:
  POST /coach/check-stagnation  - Analyze weight trends (Floating Anchor algorithm)
  POST /coach/apply-suggestion  - Apply a suggested diet adjustment (+/− kcal)
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas import (
    ApplySuggestionRequest,
    DietPlanResponse,
    StagnationCheckRequest,
    StagnationResult,
)
from app.services.coach import apply_suggestion, check_stagnation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/coach", tags=["Bulking Coach"])


@router.post("/check-stagnation", response_model=StagnationResult)
async def check_stagnation_endpoint(
    request: StagnationCheckRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Run the Floating Anchor weight analysis with Calories-First strategy.

    HOW IT WORKS:
      1. Identifies the most recent BodyLog as anchor (T_curr)
      2. Calculates average weight in a 7-day window ending on T_curr
      3. Finds the most recent log before that window as previous anchor (T_prev)
      4. Calculates average weight in a 7-day window ending on T_prev
      5. Normalizes the rate by actual weeks elapsed between anchors
      6. Applies Tri-State decision logic (Calories-First):
         - Loss (< 0 kg/wk): +500 kcal, +125g carbs
         - Slow Gain (0–0.125 kg/wk): +250 kcal, +62.5g carbs
         - Optimal (0.125–0.375 kg/wk): no change
         - High Velocity (> 0.375 kg/wk): −250 kcal, −62.5g carbs

    REQUIREMENTS:
      - At least 2 body log entries with at least one before the current 7-day window
      - The more daily entries, the more accurate the analysis

    Returns:
      - Weight averages, weekly rate, and monthly projection
      - Calorie/carb adjustment suggestion (positive or negative)
      - Stop-condition flags (waist-vs-arm, body fat ceiling)
    """
    try:
        result = await check_stagnation(db, request.user_id)
        return StagnationResult(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/apply-suggestion", response_model=DietPlanResponse)
async def apply_suggestion_endpoint(
    request: ApplySuggestionRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Apply a coach suggestion to the active diet plan.

    Supports both positive (surplus) and negative (deficit) adjustments.

    Typical flow:
      1. Call POST /coach/check-stagnation → get suggestion
      2. Review the suggestion
      3. Call POST /coach/apply-suggestion → update the plan

    The active plan's target_calories and target_carbs will be adjusted
    by the specified amounts. Other targets (protein, fat) remain unchanged.
    """
    try:
        updated_plan = await apply_suggestion(
            db=db,
            user_id=request.user_id,
            calorie_adjustment=request.calorie_adjustment,
            carb_adjustment_g=request.carb_adjustment_g,
            w_curr=request.w_curr,
            w_prev=request.w_prev,
        )
        return updated_plan
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
