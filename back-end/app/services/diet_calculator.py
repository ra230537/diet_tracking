"""
Diet Calculation Service
=========================
Handles the calculation of actual nutritional intake from the diet plan.

This service:
  1. Fetches the full diet plan hierarchy (Plan -> Variations -> Meals -> MealItems -> FoodItems)
  2. Calculates the macros for each MealItem using the 100g formula
  3. Sums up totals per meal, per variation, and for the entire plan
  4. Compares actual intake against the plan's targets

The core formula for each MealItem is:
  actual_value = (quantity_grams / 100) * food_item.value_per_100g

Example:
  If a MealItem has 200g of Chicken Breast (31g protein per 100g):
  actual_protein = (200 / 100) * 31 = 62g protein
"""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import DietPlan, DietVariation, Meal, MealItem

logger = logging.getLogger(__name__)


def _build_meals_data(meals: list) -> tuple[list[dict], float, float, float, float]:
    """
    Build meals data with calculated macros from a list of Meal ORM objects.

    Returns:
        Tuple of (meals_data, total_cal, total_pro, total_carb, total_fat)
    """
    meals_data = []
    total_calories = 0.0
    total_protein = 0.0
    total_carbs = 0.0
    total_fat = 0.0

    for meal in meals:
        meal_total_calories = 0.0
        meal_total_protein = 0.0
        meal_total_carbs = 0.0
        meal_total_fat = 0.0

        items_data = []

        for item in meal.items:
            calc_cal = round((item.quantity_grams / 100) * item.food_item.calories_kcal, 2)
            calc_pro = round((item.quantity_grams / 100) * item.food_item.protein_g, 2)
            calc_carb = round((item.quantity_grams / 100) * item.food_item.carbs_g, 2)
            calc_fat = round((item.quantity_grams / 100) * item.food_item.fat_g, 2)

            items_data.append({
                "id": item.id,
                "food_item_id": item.food_item_id,
                "food_item_name": item.food_item.name,
                "quantity_grams": item.quantity_grams,
                "calculated_calories": calc_cal,
                "calculated_protein": calc_pro,
                "calculated_carbs": calc_carb,
                "calculated_fat": calc_fat,
            })

            meal_total_calories += calc_cal
            meal_total_protein += calc_pro
            meal_total_carbs += calc_carb
            meal_total_fat += calc_fat

        meals_data.append({
            "id": meal.id,
            "name": meal.name,
            "order_index": meal.order_index,
            "items": items_data,
            "total_calories": round(meal_total_calories, 2),
            "total_protein": round(meal_total_protein, 2),
            "total_carbs": round(meal_total_carbs, 2),
            "total_fat": round(meal_total_fat, 2),
        })

        total_calories += meal_total_calories
        total_protein += meal_total_protein
        total_carbs += meal_total_carbs
        total_fat += meal_total_fat

    return (
        meals_data,
        round(total_calories, 2),
        round(total_protein, 2),
        round(total_carbs, 2),
        round(total_fat, 2),
    )


def _build_variation_data(variation) -> dict:
    """
    Build variation data with calculated macros from a DietVariation ORM object.
    Used by both get_current_diet_full and the rename_variation endpoint.
    """
    meals_data, total_cal, total_pro, total_carb, total_fat = _build_meals_data(variation.meals)

    return {
        "id": variation.id,
        "name": variation.name,
        "order_index": variation.order_index,
        "created_at": variation.created_at,
        "meals": meals_data,
        "total_calories": total_cal,
        "total_protein": total_pro,
        "total_carbs": total_carb,
        "total_fat": total_fat,
    }


async def get_current_diet_full(
    db: AsyncSession,
    user_id: str = "default_user",
) -> dict:
    """
    Retrieve the full current diet plan with calculated macros.
    
    This is the main function called by GET /diet/current.
    It builds the complete hierarchy:
      Plan -> Variations -> Meals -> Items (with calculated macros) -> Totals -> Comparisons
    
    Args:
        db: Async database session
        user_id: The user whose active plan to fetch
    
    Returns:
        dict containing the full plan data with calculated values
    
    Raises:
        ValueError: If no active diet plan is found
    """
    # Fetch the active plan with all related data eager-loaded.
    stmt = (
        select(DietPlan)
        .where(DietPlan.user_id == user_id)
        .where(DietPlan.is_active == True)
        .options(
            # Load variations with their meals and items
            selectinload(DietPlan.variations)
            .selectinload(DietVariation.meals)
            .selectinload(Meal.items)
            .selectinload(MealItem.food_item),
            # Also load direct meals (for backward compat with plans without variations)
            selectinload(DietPlan.meals)
            .selectinload(Meal.items)
            .selectinload(MealItem.food_item),
        )
    )
    result = await db.execute(stmt)
    plan = result.scalar_one_or_none()

    if not plan:
        raise ValueError(
            f"No active diet plan found for user '{user_id}'. "
            "Create a diet plan first using POST /diet/plans."
        )

    # Build variations data
    variations_data = []
    for variation in sorted(plan.variations, key=lambda v: v.order_index):
        var_data = _build_variation_data(variation)
        variations_data.append(var_data)

    # For backward compatibility: use the first variation's meals as the top-level meals
    # If there are no variations, use plan.meals directly (legacy data)
    if variations_data:
        first_variation = variations_data[0]
        top_level_meals = first_variation["meals"]
        grand_total_calories = first_variation["total_calories"]
        grand_total_protein = first_variation["total_protein"]
        grand_total_carbs = first_variation["total_carbs"]
        grand_total_fat = first_variation["total_fat"]
    else:
        # Legacy path: plan has meals without variations
        top_level_meals, grand_total_calories, grand_total_protein, grand_total_carbs, grand_total_fat = (
            _build_meals_data(plan.meals)
        )

    # Build macro comparisons (target vs actual from first variation)
    def make_comparison(target: float, actual: float) -> dict:
        return {
            "target": target,
            "actual": actual,
            "difference": round(actual - target, 2),
            "percentage": round((actual / target) * 100, 1) if target > 0 else 0.0,
        }

    return {
        "id": plan.id,
        "user_id": plan.user_id,
        "is_active": plan.is_active,
        "created_at": plan.created_at,
        "target_calories": plan.target_calories,
        "target_protein": plan.target_protein,
        "target_carbs": plan.target_carbs,
        "target_fat": plan.target_fat,
        "variations": variations_data,
        "meals": top_level_meals,
        "total_calories": grand_total_calories,
        "total_protein": grand_total_protein,
        "total_carbs": grand_total_carbs,
        "total_fat": grand_total_fat,
        "calories_comparison": make_comparison(plan.target_calories, grand_total_calories),
        "protein_comparison": make_comparison(plan.target_protein, grand_total_protein),
        "carbs_comparison": make_comparison(plan.target_carbs, grand_total_carbs),
        "fat_comparison": make_comparison(plan.target_fat, grand_total_fat),
    }
