"""
Bulking Coach Service — Stagnation Detection & Diet Adjustment
================================================================
This service implements the "Bulking Coach" algorithm that monitors
the user's weight progress and detects when they've hit a plateau.

ALGORITHM:
  1. Fetch the last 14 days of BodyLog entries for the user.
  2. Split into two groups:
     - Current week: last 7 days (days 1-7)
     - Previous week: days 8-14
  3. Calculate the average weight for each group.
  4. Compare the averages:
     - If gain <= 0.1 kg → STAGNATION DETECTED
     - If gain > 0.1 kg → Making progress, no changes needed
  5. If stagnating, suggest:
     - Carb increase = current_weight * 0.5 grams
     - Calorie increase = carb_increase * 4

RATIONALE:
  During a bulk, consistent weight gain indicates the caloric surplus is working.
  If weight stalls (gain ≤ 0.1 kg/week), the surplus may be insufficient.
  The suggestion adds carbs (the primary fuel source) to break the plateau.
  The multiplier of 0.5g per kg bodyweight is a conservative, sustainable increase.
"""

import logging
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import BodyLog, DietPlan

logger = logging.getLogger(__name__)


async def check_stagnation(
    db: AsyncSession,
    user_id: str = "default_user",
) -> dict:
    """
    Analyze the user's weight history to detect stagnation.
    
    Steps:
      1. Query the last 14 days of body logs
      2. Split into current week (0-6 days ago) and previous week (7-13 days ago)
      3. Calculate average weight for each period
      4. Determine if the user is stagnating (gain <= 0.1 kg)
      5. If stagnating, calculate a carb/calorie increase suggestion
    
    Args:
        db: Async database session
        user_id: The user to analyze
    
    Returns:
        dict containing the analysis results and any suggestions
    
    Raises:
        ValueError: If there isn't enough data (need at least 1 entry per week)
    """
    today = date.today()
    fourteen_days_ago = today - timedelta(days=14)

    # Step 1: Fetch all body logs from the last 14 days, ordered by date
    stmt = (
        select(BodyLog)
        .where(BodyLog.user_id == user_id)
        .where(BodyLog.date >= fourteen_days_ago)
        .where(BodyLog.date <= today)
        .order_by(BodyLog.date.desc())
    )
    result = await db.execute(stmt)
    logs = result.scalars().all()

    if len(logs) < 2:
        raise ValueError(
            "Not enough data to analyze stagnation. "
            "Need at least 2 body log entries in the last 14 days. "
            f"Found: {len(logs)} entries."
        )

    # Step 2: Split logs into current week and previous week
    seven_days_ago = today - timedelta(days=7)

    current_week_logs = [log for log in logs if log.date > seven_days_ago]
    previous_week_logs = [log for log in logs if log.date <= seven_days_ago]

    # Validate that both periods have data
    if not current_week_logs:
        raise ValueError(
            "No body log entries found for the current week (last 7 days). "
            "Please log your weight more frequently."
        )

    if not previous_week_logs:
        raise ValueError(
            "No body log entries found for the previous week (8-14 days ago). "
            "Please log your weight more frequently."
        )

    # Step 3: Calculate average weights
    current_week_avg = sum(log.weight_kg for log in current_week_logs) / len(current_week_logs)
    previous_week_avg = sum(log.weight_kg for log in previous_week_logs) / len(previous_week_logs)

    # Step 4: Calculate the weight change
    weight_change = current_week_avg - previous_week_avg
    is_stagnating = weight_change <= 0.1

    logger.info(
        f"Stagnation check for user '{user_id}': "
        f"prev_avg={previous_week_avg:.2f}kg, "
        f"curr_avg={current_week_avg:.2f}kg, "
        f"change={weight_change:.2f}kg, "
        f"stagnating={is_stagnating}"
    )

    # Step 5: Build the result
    result_data = {
        "current_week_avg_weight": round(current_week_avg, 2),
        "previous_week_avg_weight": round(previous_week_avg, 2),
        "weight_change_kg": round(weight_change, 2),
        "is_stagnating": is_stagnating,
    }

    if is_stagnating:
        # Calculate the suggestion based on current weight
        # Formula: carb_increase = current_weight * 0.5
        carb_increase = round(current_week_avg * 0.5, 1)
        calorie_increase = round(carb_increase * 4, 1)

        # Fetch the active diet plan to show what the new targets would be
        plan_stmt = (
            select(DietPlan)
            .where(DietPlan.user_id == user_id)
            .where(DietPlan.is_active == True)
        )
        plan_result = await db.execute(plan_stmt)
        active_plan = plan_result.scalar_one_or_none()

        result_data.update({
            "message": (
                f"⚠️ Stagnation detected! Weight gain was only {weight_change:.2f} kg "
                f"(threshold: 0.1 kg). Recommend increasing carbs by {carb_increase}g "
                f"(+{calorie_increase} kcal) to break through the plateau."
            ),
            "suggested_carb_increase_g": carb_increase,
            "suggested_calorie_increase": calorie_increase,
        })

        # If there's an active plan, calculate what the new targets would be
        if active_plan:
            result_data["new_target_calories"] = round(
                active_plan.target_calories + calorie_increase, 1
            )
            result_data["new_target_carbs"] = round(
                active_plan.target_carbs + carb_increase, 1
            )
    else:
        result_data["message"] = (
            f"✅ Good progress! Weight increased by {weight_change:.2f} kg this week. "
            f"Keep following your current plan."
        )
        result_data["suggested_carb_increase_g"] = None
        result_data["suggested_calorie_increase"] = None
        result_data["new_target_calories"] = None
        result_data["new_target_carbs"] = None

    return result_data


async def apply_suggestion(
    db: AsyncSession,
    user_id: str,
    calorie_increase: float,
    carb_increase_g: float,
) -> DietPlan:
    """
    Apply a coach suggestion by increasing the active diet plan's targets.
    
    This updates the active DietPlan by adding the suggested increases
    to the current calorie and carb targets.
    
    Args:
        db: Async database session
        user_id: The user whose plan to update
        calorie_increase: Calories to add to the current target
        carb_increase_g: Carbs (g) to add to the current target
    
    Returns:
        The updated DietPlan object
    
    Raises:
        ValueError: If no active diet plan is found
    """
    # Find the active diet plan
    stmt = (
        select(DietPlan)
        .where(DietPlan.user_id == user_id)
        .where(DietPlan.is_active == True)
    )
    result = await db.execute(stmt)
    plan = result.scalar_one_or_none()

    if not plan:
        raise ValueError(
            f"No active diet plan found for user '{user_id}'. "
            "Please create a diet plan first."
        )

    # Apply the increases
    old_calories = plan.target_calories
    old_carbs = plan.target_carbs

    plan.target_calories = round(plan.target_calories + calorie_increase, 1)
    plan.target_carbs = round(plan.target_carbs + carb_increase_g, 1)

    await db.commit()
    await db.refresh(plan)

    logger.info(
        f"Applied coach suggestion for user '{user_id}': "
        f"calories {old_calories} -> {plan.target_calories} (+{calorie_increase}), "
        f"carbs {old_carbs} -> {plan.target_carbs} (+{carb_increase_g}g)"
    )

    return plan
