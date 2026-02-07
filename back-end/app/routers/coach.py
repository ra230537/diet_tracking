"""
Bulking Coach Router
=====================
Endpoints for the intelligent coaching system that detects stagnation
and suggests diet adjustments.

Endpoints:
  POST /coach/check-stagnation  - Analyze weight trends and detect plateaus
  POST /coach/apply-suggestion  - Apply a suggested diet adjustment
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
    Run the Bulking Coach stagnation detection algorithm.
    
    HOW IT WORKS:
      1. Fetches body weight logs from the last 14 days
      2. Calculates the average weight for days 1-7 (current week)
         and days 8-14 (previous week)
      3. If weight gain <= 0.1 kg, flags stagnation
      4. If stagnating, suggests increasing carbs by (current_weight * 0.5) grams
         and calories by (carb_increase * 4)
    
    REQUIREMENTS:
      - At least 1 body log entry in each of the two 7-day periods
      - The more daily entries, the more accurate the analysis
    
    Returns:
      - Weight averages and change
      - Whether stagnation is detected
      - Suggested adjustments (if stagnating)
      - New target values (if an active plan exists)
    """
    try:
        result = await check_stagnation(db, request.user_id)
        return StagnationResult(**result)
    except ValueError as e:
        # Not enough data or other validation errors
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/apply-suggestion", response_model=DietPlanResponse)
async def apply_suggestion_endpoint(
    request: ApplySuggestionRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Apply a coach suggestion to the active diet plan.
    
    This endpoint takes the calorie and carb increases suggested by
    the stagnation check and adds them to the current active diet plan's targets.
    
    Typical flow:
      1. Call POST /coach/check-stagnation -> get suggestion
      2. Review the suggestion
      3. Call POST /coach/apply-suggestion -> update the plan
    
    The active plan's target_calories and target_carbs will be increased
    by the specified amounts. Other targets (protein, fat) remain unchanged.
    """
    try:
        updated_plan = await apply_suggestion(
            db=db,
            user_id=request.user_id,
            calorie_increase=request.calorie_increase,
            carb_increase_g=request.carb_increase_g,
        )
        return updated_plan
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
